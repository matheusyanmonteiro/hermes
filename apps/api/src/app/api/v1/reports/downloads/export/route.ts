import ExcelJS from "exceljs";
import { PERMISSIONS } from "@hermes/permissions";
import { authenticate, requirePermission } from "@/lib/auth";
import { apiRoute, queryObject } from "@/lib/http";
import { confirmationLevel, downloadReport } from "@/lib/reports";

function csvCell(value: unknown): string {
  let text = value instanceof Date ? value.toISOString() : typeof value === "bigint" ? value.toString() : String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export const GET = apiRoute(async (request) => {
  const auth = await authenticate(request);
  requirePermission(auth, PERMISSIONS.REPORTS_EXPORT);
  const raw = queryObject(request);
  const format = raw.format === "xlsx" ? "xlsx" : "csv";
  delete raw.format;
  const report = await downloadReport(raw);
  const filename = `relatorio-downloads-${new Date().toISOString().slice(0, 10)}`;

  if (format === "csv") {
    const rows = [
      ["evento_id", "data_hora_utc", "usuario", "email", "video", "origem", "status", "nivel_confirmacao", "transferencia_id", "bytes"],
      ...report.events.map((event) => [
        event.id,
        event.occurredAt,
        event.user.name,
        event.user.email,
        event.transfer.fileNameSnapshot,
        event.transfer.sourceSnapshot,
        event.eventType,
        confirmationLevel(event.eventType),
        event.transferId,
        event.bytesTransferred ?? 0n,
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
    return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${filename}.csv"`, "cache-control": "private, no-store" } });
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Hermes";
  workbook.created = new Date();
  const summary = workbook.addWorksheet("Resumo executivo");
  summary.addRows([
    ["Indicador", "Total"],
    ["Usuários", report.summary.users],
    ["Vídeos", report.summary.videos],
    ["Solicitações", report.summary.requested],
    ["Conclusões informadas", report.summary.completed],
    ["Falhas", report.summary.failed],
    ["Resultados desconhecidos", report.summary.unknown],
  ]);

  const users = workbook.addWorksheet("Downloads por usuário");
  users.addRow(["Usuário", "E-mail", "Solicitações", "Conclusões", "Vídeos distintos", "Primeira operação UTC", "Última operação UTC"]);
  report.users.forEach((item) => users.addRow([item.name, item.email, item.requests, item.completions, item.distinctVideos, item.firstAt, item.lastAt]));

  const videos = workbook.addWorksheet("Downloads por vídeo");
  videos.addRow(["Vídeo", "Origem", "Tamanho em bytes", "Solicitações", "Conclusões"]);
  report.videos.forEach((item) => videos.addRow([item.name, item.source, item.sizeBytes.toString(), item.requests, item.completions]));

  const history = workbook.addWorksheet("Histórico detalhado");
  history.addRow(["Data/hora UTC", "Usuário", "E-mail", "Vídeo", "Origem", "Status", "Nível de confirmação", "Transferência", "Evento", "Bytes"]);
  report.events.forEach((event) => history.addRow([event.occurredAt, event.user.name, event.user.email, event.transfer.fileNameSnapshot, event.transfer.sourceSnapshot, event.eventType, confirmationLevel(event.eventType), event.transferId, event.id, event.bytesTransferred?.toString() ?? "0"]));

  for (const sheet of workbook.worksheets) {
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF17324D" } };
    sheet.columns.forEach((column) => {
      const values = column.values ?? [];
      column.width = Math.min(48, Math.max(14, ...values.slice(1).map((value) => String(value ?? "").length + 2)));
    });
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } };
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer), { headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename="${filename}.xlsx"`, "cache-control": "private, no-store" } });
});

import { uuidSchema } from "@hermes/contracts";
import { prisma } from "@hermes/database";
import { PERMISSIONS } from "@hermes/permissions";
import { authenticate, requirePermission } from "@/lib/auth";
import { auditActionLabel, auditResourceLabel } from "@/lib/audit-labels";
import { ApiError } from "@/lib/errors";
import { apiRoute } from "@/lib/http";

const printable = (value: string) => value.replace(/[^\x20-\xFF]/g, "?").replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
const latin1 = (value: string) => Buffer.from(value, "latin1");
const shorten = (value: string, size: number) => value.length > size ? `${value.slice(0, size - 3)}...` : value;
const text = (value: string, x: number, y: number, size = 8) => `BT /F1 ${size} Tf ${x} ${y} Td (${printable(value)}) Tj ET`;
function createPdf(title: string, subtitle: string, issuedAt: string, rows: string[][]): ArrayBuffer {
  const perPage = 24; const pages = Array.from({ length: Math.max(1, Math.ceil(rows.length / perPage)) }, (_, index) => rows.slice(index * perPage, (index + 1) * perPage));
  const fontObject = 3 + pages.length * 2;
  const objects: string[] = ["<</Type /Catalog /Pages 2 0 R>>", `<</Type /Pages /Kids [${pages.map((_, index) => `${3 + index * 2} 0 R`).join(" ")}] /Count ${pages.length}>>`];
  pages.forEach((page, pageIndex) => {
    const header = [`0.05 0.20 0.36 rg 42 760 511 38 re f`, `1 1 1 rg`, text(title, 54, 781, 15), text(subtitle, 54, 766, 8), `0.12 0.45 0.80 rg 42 724 511 21 re f`, `1 1 1 rg`, text("DATA E HORA", 49, 732, 7), text("EVENTO", 146, 732, 7), text("RECURSO", 273, 732, 7), text("ID DA OPERAÇÃO", 460, 732, 7), `0 0 0 RG 0.8 w 42 724 m 553 724 l S`];
    const tableRows = page.flatMap((row, index) => {
      const y = 701 - index * 23;
      const shade = index % 2 === 0 ? "0.97 0.98 0.99 rg" : "1 1 1 rg";
      return [shade, `42 ${y - 7} 511 23 re f`, `0.85 0.88 0.91 RG 0.4 w 42 ${y - 7} m 553 ${y - 7} l S`, `0 0 0 rg`, text(shorten(row[0], 17), 49, y, 7), text(shorten(row[1], 23), 146, y, 7), text(shorten(row[2], 35), 273, y, 7), text(shorten(row[3], 11), 480, y, 7)];
    });
    const footer = [text(`Emitido em ${issuedAt} | Página ${pageIndex + 1} de ${pages.length}`, 42, 35, 7)];
    const commands = [...header, ...tableRows, ...footer].join("\n");
    const pageObject = 3 + pageIndex * 2; const contentObject = pageObject + 1;
    objects.push(`<</Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources <</Font <</F1 ${fontObject} 0 R>>>> /Contents ${contentObject} 0 R>>`);
    objects.push(`<</Length ${latin1(commands).length}>>\nstream\n${commands}\nendstream`);
  });
  objects.push("<</Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding>>");
  let pdf = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(latin1(pdf).length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = latin1(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<</Size ${objects.length + 1} /Root 1 0 R>>\nstartxref\n${xref}\n%%EOF`;
  const bytes = latin1(pdf);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
export const GET = apiRoute(async (request, context) => {
  const auth = await authenticate(request); requirePermission(auth, PERMISSIONS.USERS_VIEW);
  const { id } = await (context as { params: Promise<{ id: string }> }).params; const userId = uuidSchema.parse(id);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } });
  if (!user) throw new ApiError(404, "USER_NOT_FOUND", "Usuário não encontrado");
  const [logs, downloads] = await Promise.all([
    prisma.auditLog.findMany({ where: { OR: [{ actorId: userId }, { resourceType: "user", resourceId: userId }] }, orderBy: { occurredAt: "desc" }, take: 100, select: { action: true, resourceType: true, resourceId: true, occurredAt: true, correlationId: true } }),
    prisma.downloadEvent.findMany({ where: { userId, eventType: "COMPLETED_CLIENT" }, orderBy: { occurredAt: "desc" }, take: 100, select: { occurredAt: true, correlationId: true, transfer: { select: { id: true, fileNameSnapshot: true } } } }),
  ]);
  const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
  const events = [
    ...logs.map((log) => ({ ...log, actionLabel: auditActionLabel(log.action), resourceLabel: auditResourceLabel(log.resourceType), resourceName: null as string | null })),
    ...downloads.map((download) => ({ occurredAt: download.occurredAt, correlationId: download.correlationId, resourceId: download.transfer.id, actionLabel: "Vídeo baixado", resourceLabel: "Vídeo", resourceName: download.transfer.fileNameSnapshot })),
  ].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  const rows = events.map((event) => [date.format(event.occurredAt), event.actionLabel, event.resourceName ?? event.resourceLabel, event.correlationId]);
  return new Response(createPdf("AUDITORIA DE USUARIO", `${user.name} | ${user.email}`, date.format(new Date()), rows), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename=auditoria-${user.id}.pdf`, "access-control-allow-origin": process.env.WEB_URL ?? "http://localhost:3000", "access-control-allow-credentials": "true", vary: "Origin" } });
});

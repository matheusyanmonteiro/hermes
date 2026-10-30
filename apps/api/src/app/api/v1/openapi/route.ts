import { json } from "@/lib/http";

export const dynamic = "force-static";

export function GET() {
  return json({
    openapi: "3.1.0",
    info: {
      title: "Hermes API",
      version: "1.0.0",
      description: "API versionada do portal de mídias educacionais Hermes.",
    },
    servers: [{ url: process.env.API_URL ?? "http://localhost:3001", description: "Ambiente atual" }],
    components: {
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
      headers: { CorrelationId: { description: "Identificador de rastreamento", schema: { type: "string", format: "uuid" } } },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      "/api/v1/health": { get: { security: [], summary: "Saúde da API e banco", responses: { "200": { description: "Serviço saudável" } } } },
      "/api/v1/auth/me": { get: { summary: "Usuário autenticado", responses: { "200": { description: "Identidade e permissões" }, "401": { description: "Não autenticado" } } } },
      "/api/v1/videos": { get: { summary: "Lista e filtra vídeos", responses: { "200": { description: "Página de vídeos" } } } },
      "/api/v1/downloads": { post: { summary: "Cria lote de download auditado", parameters: [{ in: "header", name: "Idempotency-Key", required: true, schema: { type: "string" } }], responses: { "201": { description: "Lote autorizado" } } } },
      "/api/v1/uploads/sessions": { post: { summary: "Inicia sessões retomáveis de upload", parameters: [{ in: "header", name: "Idempotency-Key", required: true, schema: { type: "string" } }], responses: { "201": { description: "Sessões criadas" } } } },
      "/api/v1/transfers": { get: { summary: "Lista transferências", responses: { "200": { description: "Página de transferências" } } } },
      "/api/v1/reports/downloads": { get: { summary: "Relatório de downloads", responses: { "200": { description: "Resumo e dados detalhados" } } } },
      "/api/v1/reports/downloads/export": { get: { summary: "Exporta CSV ou XLSX", responses: { "200": { description: "Arquivo do relatório" } } } },
      "/api/v1/campaign": { get: { summary: "Consulta campanha", responses: { "200": { description: "Campanha atual" } } }, put: { summary: "Configura campanha", responses: { "200": { description: "Campanha atualizada" } } } },
    },
  });
}

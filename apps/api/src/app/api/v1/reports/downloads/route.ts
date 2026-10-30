import { PERMISSIONS } from "@hermes/permissions";
import { authenticate, requirePermission } from "@/lib/auth";
import { apiRoute, json, queryObject } from "@/lib/http";
import { downloadReport } from "@/lib/reports";

export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request) => {
  const auth = await authenticate(request);
  requirePermission(auth, PERMISSIONS.REPORTS_VIEW);
  const report = await downloadReport(queryObject(request));
  return json(report);
});

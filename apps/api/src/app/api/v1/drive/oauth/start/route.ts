import { PERMISSIONS } from "@hermes/permissions";
import { authenticate, requirePermission } from "@/lib/auth";
import { googleAuthorizationUrl } from "@/lib/google-drive";
import { apiRoute, json } from "@/lib/http";
import { createOauthState } from "@/lib/oauth-state";
import { enforceRateLimit } from "@/lib/rate-limit";

export const POST = apiRoute(async (request) => {
  const auth = await authenticate(request);
  requirePermission(auth, PERMISSIONS.DRIVE_MANAGE);
  await enforceRateLimit(request, "drive.oauth", auth.user.id, 10, 60 * 60);
  const state = await createOauthState(auth.user.id);
  const callbackUrl = new URL(
    "/api/v1/drive/oauth/callback",
    process.env.API_URL ?? request.url,
  ).toString();
  return json({
    authorizationUrl: await googleAuthorizationUrl(state, callbackUrl),
  });
});

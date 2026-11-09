import { prisma } from "@hermes/database";
import { encryptSecret } from "@/lib/crypto";
import { ApiError, normalizeError } from "@/lib/errors";
import {
  exchangeAuthorizationCode,
  getGoogleProfile,
} from "@/lib/google-drive";
import { verifyOauthState } from "@/lib/oauth-state";

export async function GET(request: Request): Promise<Response> {
  const webUrl = process.env.WEB_URL ?? "http://localhost:3000";
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state)
      throw new ApiError(
        400,
        "OAUTH_CALLBACK_INVALID",
        "O retorno do Google está incompleto",
      );
    const actorId = await verifyOauthState(state);
    const callbackUrl = new URL(
      "/api/v1/drive/oauth/callback",
      process.env.API_URL ?? request.url,
    ).toString();
    const token = await exchangeAuthorizationCode(code, callbackUrl);
    const profile = await getGoogleProfile(token.access_token);
    const account = await prisma.driveAccount.upsert({
      where: { email: profile.email },
      update: {
        displayName: profile.name,
        status: "CONNECTED",
        tokenEncrypted: encryptSecret(token.access_token),
        refreshTokenEncrypted: token.refresh_token
          ? encryptSecret(token.refresh_token)
          : undefined,
        tokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
        lastError: null,
      },
      create: {
        email: profile.email,
        displayName: profile.name,
        status: "CONNECTED",
        tokenEncrypted: encryptSecret(token.access_token),
        refreshTokenEncrypted: token.refresh_token
          ? encryptSecret(token.refresh_token)
          : null,
        tokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
      },
    });
    await prisma.auditLog.create({
      data: {
        actorId,
        action: "drive.account.connected",
        resourceType: "drive_account",
        resourceId: account.id,
        after: { email: account.email },
        correlationId: crypto.randomUUID(),
      },
    });
    return Response.redirect(`${webUrl}/contas?conectada=1`, 303);
  } catch (error) {
    const normalized = normalizeError(error);
    const redirect = new URL("/contas", webUrl);
    redirect.searchParams.set("erro", normalized.code);
    return Response.redirect(redirect, 303);
  }
}

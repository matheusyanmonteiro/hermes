import { prisma } from "@hermes/database";
import { decryptSecret, encryptSecret } from "./crypto";
import { ApiError } from "./errors";

const tokenEndpoint = "https://oauth2.googleapis.com/token";

function googleCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new ApiError(503, "GOOGLE_NOT_CONFIGURED", "A integração com o Google Drive ainda não foi configurada");
  }
  return { clientId, clientSecret, redirectUri };
}

export function googleAuthorizationUrl(state: string): string {
  const { clientId, redirectUri } = googleCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: "openid email profile https://www.googleapis.com/auth/drive",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeAuthorizationCode(code: string) {
  const { clientId, clientSecret, redirectUri } = googleCredentials();
  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
  });
  if (!response.ok) throw new ApiError(502, "GOOGLE_TOKEN_EXCHANGE_FAILED", "O Google não autorizou a conexão");
  return (await response.json()) as { access_token: string; refresh_token?: string; expires_in: number };
}

export async function getGoogleProfile(accessToken: string): Promise<{ email: string; name?: string }> {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new ApiError(502, "GOOGLE_PROFILE_FAILED", "Não foi possível identificar a conta Google");
  const profile = (await response.json()) as { email?: string; name?: string };
  if (!profile.email) throw new ApiError(502, "GOOGLE_PROFILE_FAILED", "A conta Google não informou um e-mail");
  return { email: profile.email.toLowerCase(), name: profile.name };
}

export async function getDriveAccessToken(accountId: string): Promise<string> {
  const account = await prisma.driveAccount.findUnique({ where: { id: accountId } });
  if (!account || account.status !== "CONNECTED" || !account.tokenEncrypted) {
    throw new ApiError(409, "DRIVE_ACCOUNT_DISCONNECTED", "A conta do Google Drive não está conectada");
  }
  if (account.tokenExpiresAt && account.tokenExpiresAt.getTime() > Date.now() + 60_000) {
    return decryptSecret(account.tokenEncrypted);
  }
  if (!account.refreshTokenEncrypted) throw new ApiError(409, "DRIVE_RECONNECT_REQUIRED", "Reconecte a conta do Google Drive");

  const { clientId, clientSecret } = googleCredentials();
  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: decryptSecret(account.refreshTokenEncrypted),
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) {
    await prisma.driveAccount.update({ where: { id: accountId }, data: { status: "ERROR", lastError: "Falha ao renovar a autorização" } });
    throw new ApiError(409, "DRIVE_RECONNECT_REQUIRED", "A autorização expirou; reconecte a conta");
  }
  const token = (await response.json()) as { access_token: string; expires_in: number };
  await prisma.driveAccount.update({
    where: { id: accountId },
    data: { tokenEncrypted: encryptSecret(token.access_token), tokenExpiresAt: new Date(Date.now() + token.expires_in * 1000), status: "CONNECTED", lastError: null },
  });
  return token.access_token;
}

export async function driveFetch(accountId: string, url: string, init: RequestInit = {}): Promise<Response> {
  const token = await getDriveAccessToken(accountId);
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const origin = process.env.WEB_URL ?? "http://localhost:3000";
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Headers": "Authorization, Content-Type, Idempotency-Key, X-Correlation-Id",
        "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
        Vary: "Origin",
      },
    });
  }
  const response = NextResponse.next();
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Vary", "Origin");
  return response;
}

export const config = { matcher: "/api/:path*" };

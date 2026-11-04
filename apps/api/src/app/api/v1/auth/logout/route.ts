import { clearSessionCookie } from "@/lib/auth";
import { apiRoute, noContent } from "@/lib/http";

export const POST = apiRoute(async () => clearSessionCookie(noContent()));

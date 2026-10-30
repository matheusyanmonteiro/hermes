import { authenticate } from "@/lib/auth";
import { apiRoute, json } from "@/lib/http";

export const GET = apiRoute(async (request) => {
  const auth = await authenticate(request);
  return json(auth);
});

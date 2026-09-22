import { privateFileResponse } from "@/lib/storage";
import { parentPhotoPathname } from "@/modules/tutoring/share";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Parent access: the token must be live and the photo must belong to the
// student that token was issued for (enforced by RLS inside the scope).
export async function GET(request: Request, { params }: RouteContext<"/p/[token]/photos/[id]">) {
  const { token, id } = await params;
  if (!UUID.test(id)) return new Response("Not found", { status: 404 });
  const pathname = await parentPhotoPathname(token, id);
  if (!pathname) return new Response("Not found", { status: 404 });
  const response = await privateFileResponse(pathname, request);
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

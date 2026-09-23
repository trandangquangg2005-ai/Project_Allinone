import { withTenant } from "@/db";
import { getCurrentUser } from "@/lib/auth/dal";
import { privateFileResponse } from "@/lib/storage";
import { getPhoto } from "@/modules/tutoring/queries";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Owner access to a lesson photo. Authorisation sits right next to the read:
// no session, no module, or someone else's photo all look like "not found".
export async function GET(request: Request, { params }: RouteContext<"/api/photos/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) return new Response("Not found", { status: 404 });

  const user = await getCurrentUser();
  if (!user || !user.modules.includes("tutoring")) return new Response("Not found", { status: 404 });

  const photo = await withTenant(user.id, (tx) => getPhoto(tx, user.id, id));
  if (!photo) return new Response("Not found", { status: 404 });
  return privateFileResponse(photo.pathname, request, photo.contentType);
}

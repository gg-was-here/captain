import { listApps } from "@/lib/server/data";
import { requireUser, route } from "@/lib/server/user";

export const GET = route(async (request: Request) => {
  const user = await requireUser(request);
  return Response.json({ apps: await listApps(user.id) });
});

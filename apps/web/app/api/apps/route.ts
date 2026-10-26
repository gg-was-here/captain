import { after } from "next/server";
import { fillMissingTaglines, listApps } from "@/lib/server/data";
import { requireUser, route } from "@/lib/server/user";

export const GET = route(async (request: Request) => {
  const user = await requireUser(request);
  const apps = await listApps(user.id);
  after(() => fillMissingTaglines(apps).catch((error) => console.error("[apps] tagline fill failed", error)));
  return Response.json({ apps });
});

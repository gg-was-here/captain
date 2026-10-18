import { requireUser, route } from "@/lib/server/user";

export const GET = route(async (request: Request) => {
  const user = await requireUser(request);
  return Response.json({ user: { id: user.id, name: user.name ?? null, email: user.email ?? null } });
});

import { clerkConfigured } from "@captain/core/auth";
import { clerkClient } from "@clerk/nextjs/server";
import { deleteAccountData } from "@/lib/server/account";
import { requireUser, route } from "@/lib/server/user";

export const GET = route(async (request: Request) => {
  const user = await requireUser(request);
  return Response.json({ user: { id: user.id, name: user.name ?? null, email: user.email ?? null } });
});

/** Delete the account: chats (with their conversations), connector tokens, apps and their bundles, usage, settings, then the Clerk user. */
export const DELETE = route(async (request: Request) => {
  const user = await requireUser(request);
  await deleteAccountData(user.id, new URL(request.url).origin, request.headers.get("cookie") ?? undefined);
  if (clerkConfigured()) await (await clerkClient()).users.deleteUser(user.id);
  return new Response(null, { status: 204 });
});

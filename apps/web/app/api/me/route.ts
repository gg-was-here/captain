import { clerkConfigured } from "@captain/core/auth";
import { clerkClient } from "@clerk/nextjs/server";
import { consumeRate } from "@captain/core/usage";
import { deleteAccountData } from "@/lib/server/account";
import { exportAccountData } from "@/lib/server/export";
import { requireUser, route } from "@/lib/server/user";

export const GET = route(async (request: Request) => {
  if (new URL(request.url).searchParams.has("export")) return exportResponse(request);
  const user = await requireUser(request);
  return Response.json({ user: { id: user.id, name: user.name ?? null, email: user.email ?? null } });
});

/** Everything Bambii stores for the user, as a JSON download. `?export` picks this over the profile. */
async function exportResponse(request: Request) {
  const user = await requireUser(request);
  await consumeRate(user.id, "export");
  const data = await exportAccountData(user, new URL(request.url).origin);
  const day = data.exportedAt.slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="bambii-export-${day}.json"`,
      "cache-control": "no-store",
    },
  });
}

/** Delete the account: chats (with their conversations), connector tokens, apps and their bundles, usage, settings, then the Clerk user. */
export const DELETE = route(async (request: Request) => {
  const user = await requireUser(request);
  await deleteAccountData(user.id, new URL(request.url).origin, request.headers.get("cookie") ?? undefined);
  if (clerkConfigured()) await (await clerkClient()).users.deleteUser(user.id);
  return new Response(null, { status: 204 });
});

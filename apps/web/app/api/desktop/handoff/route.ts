import { clerkConfigured } from "@captain/core/auth";
import { consumeRate } from "@captain/core/usage";
import { clerkClient } from "@clerk/nextjs/server";
import { HttpError, requireUser, route } from "@/lib/server/user";

/**
 * Mints a short-lived, single-use Clerk sign-in token for the signed-in browser user,
 * which `/desktop/sign-in` hands to the Mac app over its loopback listener.
 */
export const POST = route(async (request: Request) => {
  const user = await requireUser(request);
  if (!clerkConfigured()) throw new HttpError(400, "Clerk is not configured");
  await consumeRate(user.id, "handoff");
  const client = await clerkClient();
  const { token } = await client.signInTokens.createSignInToken({ userId: user.id, expiresInSeconds: 120 });
  return Response.json({ ticket: token });
});

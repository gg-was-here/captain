import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";
import { deleteAccountData } from "@/lib/server/account";
import { errorResponse } from "@/lib/server/user";

/**
 * Clerk events. A user deleted in Clerk (from its profile page or dashboard) gets the same cleanup as
 * Settings → Delete account. Configure the endpoint in Clerk with the `user.deleted` event and set
 * CLERK_WEBHOOK_SIGNING_SECRET.
 */
export async function POST(request: NextRequest) {
  let event: Awaited<ReturnType<typeof verifyWebhook>>;
  try {
    event = await verifyWebhook(request);
  } catch {
    return Response.json({ error: "Invalid webhook signature" }, { status: 400 });
  }
  if (event.type === "user.deleted" && event.data.id) {
    try {
      await deleteAccountData(event.data.id, new URL(request.url).origin);
    } catch (error) {
      // A failure answers 5xx, so Clerk retries the delivery later.
      return errorResponse(error, request);
    }
  }
  return new Response(null, { status: 204 });
}

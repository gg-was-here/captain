import { archiveExpiringChats } from "@/lib/server/archive";
import { errorResponse } from "@/lib/server/user";

/**
 * Daily (see vercel.json): saves the text of chats whose sessions will expire. Vercel's cron sends
 * `Authorization: Bearer $CRON_SECRET`; without CRON_SECRET set, the route refuses to run.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET isn't set" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return Response.json(await archiveExpiringChats(new URL(request.url).origin));
  } catch (error) {
    return errorResponse(error, request);
  }
}

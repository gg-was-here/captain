import { budgetStatus } from "@captain/core/usage";
import { requireUser, route } from "@/lib/server/user";

/** The user's AI spend today and this month, against their allowance. */
export const GET = route(async (request: Request) => {
  const user = await requireUser(request);
  return Response.json(await budgetStatus(user.id));
});

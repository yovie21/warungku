import { requireUser } from "@/lib/auth";
import { json, options } from "@/lib/http";

export const OPTIONS = options;

export async function GET(req: Request) {
  const { error, user } = await requireUser(req);
  if (error) return error;
  return json({ user });
}

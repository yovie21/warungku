import { prisma } from "@/lib/prisma";
import { checkPassword, signToken } from "@/lib/auth";
import { fail, json, options, readJson } from "@/lib/http";

export const OPTIONS = options;

export async function POST(req: Request) {
  try {
    const body = await readJson<{ username?: string; password?: string }>(req);
    const username = body.username?.trim();
    const password = body.password ?? "";
    if (!username || !password) return fail("username/password wajib");
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return fail("Login gagal", 401);
    const ok = await checkPassword(password, user.passwordHash);
    if (!ok) return fail("Login gagal", 401);
    const token = await signToken({ id: user.id, username: user.username, role: user.role });
    return json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "login gagal";
    return fail(msg, 500);
  }
}

import { prisma } from "@/lib/prisma";
import { audit, hashPassword, requireUser } from "@/lib/auth";
import { fail, json, options, readJson } from "@/lib/http";

export const OPTIONS = options;

export async function GET(req: Request) {
  const { error } = await requireUser(req, ["admin"]);
  if (error) return error;
  const users = await prisma.user.findMany({
    select: { id: true, username: true, role: true, createdAt: true },
    orderBy: { id: "asc" },
  });
  return json(users);
}

export async function POST(req: Request) {
  const { error, user } = await requireUser(req, ["admin"]);
  if (error) return error;
  const b = await readJson<{ username?: string; password?: string; role?: string }>(req);
  if (!b.username || !b.password) return fail("Username dan password wajib diisi");
  const existing = await prisma.user.findUnique({ where: { username: b.username } });
  if (existing) return fail("Username sudah digunakan", 400);
  try {
    const newUser = await prisma.user.create({
      data: {
        username: b.username.trim(),
        passwordHash: await hashPassword(b.password),
        role: (b.role as "admin" | "kasir" | "gudang") || "kasir",
      },
      select: { id: true, username: true, role: true, createdAt: true },
    });
    await audit(user!.id, "create", "user", newUser.id);
    return json(newUser);
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : "Gagal buat user", 500);
  }
}

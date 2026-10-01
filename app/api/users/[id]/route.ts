import { prisma } from "@/lib/prisma";
import { audit, hashPassword, requireUser } from "@/lib/auth";
import { fail, json, options, readJson } from "@/lib/http";

export const OPTIONS = options;

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error, user } = await requireUser(req, ["admin"]);
  if (error) return error;
  const id = Number((await ctx.params).id);
  const b = await readJson<{ username?: string; password?: string; role?: string }>(req);
  const data: Record<string, unknown> = {};
  if (b.username) data.username = b.username.trim();
  if (b.role) data.role = b.role;
  if (b.password) data.passwordHash = await hashPassword(b.password);
  try {
    const updated = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, username: true, role: true, createdAt: true },
    });
    await audit(user!.id, "update", "user", id);
    return json(updated);
  } catch {
    return fail("Gagal update user", 400);
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error, user } = await requireUser(req, ["admin"]);
  if (error) return error;
  const id = Number((await ctx.params).id);
  if (id === user!.id) return fail("Tidak bisa hapus akun sendiri", 400);
  try {
    await prisma.user.delete({ where: { id } });
    await audit(user!.id, "delete", "user", id);
    return json({ ok: true });
  } catch {
    return fail("Tidak bisa hapus (masih punya transaksi)", 409);
  }
}

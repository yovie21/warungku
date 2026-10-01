import { prisma } from "@/lib/prisma";
import { audit, requireUser } from "@/lib/auth";
import { fail, json, options, readJson } from "@/lib/http";

export const OPTIONS = options;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireUser(req);
  if (error) return error;
  const id = Number((await ctx.params).id);
  const c = await prisma.category.findUnique({ where: { id } });
  if (!c) return fail("Kategori tidak ditemukan", 404);
  return json(c);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error, user } = await requireUser(req, ["admin"]);
  if (error) return error;
  const id = Number((await ctx.params).id);
  const b = await readJson<{ name?: string; parentId?: number | null }>(req);
  try {
    const c = await prisma.category.update({ where: { id }, data: { name: b.name?.trim(), parentId: b.parentId ?? null } });
    await audit(user!.id, "update", "category", id);
    return json(c);
  } catch {
    return fail("Gagal update kategori", 400);
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error, user } = await requireUser(req, ["admin"]);
  if (error) return error;
  const id = Number((await ctx.params).id);
  try {
    await prisma.category.delete({ where: { id } });
    await audit(user!.id, "delete", "category", id);
    return json({ ok: true });
  } catch {
    return fail("Tidak bisa hapus (masih dipakai produk)", 409);
  }
}
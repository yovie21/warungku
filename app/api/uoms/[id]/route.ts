import { prisma } from "@/lib/prisma";
import { audit, requireUser } from "@/lib/auth";
import { fail, json, options, readJson } from "@/lib/http";

export const OPTIONS = options;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireUser(req);
  if (error) return error;
  const id = Number((await ctx.params).id);
  const u = await prisma.uom.findUnique({ where: { id } });
  if (!u) return fail("UOM tidak ditemukan", 404);
  return json(u);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error, user } = await requireUser(req, ["admin"]);
  if (error) return error;
  const id = Number((await ctx.params).id);
  const b = await readJson<{ name?: string; symbol?: string }>(req);
  try {
    const u = await prisma.uom.update({ where: { id }, data: { name: b.name?.trim(), symbol: b.symbol?.trim() ?? "" } });
    await audit(user!.id, "update", "uom", id);
    return json(u);
  } catch {
    return fail("Gagal update UOM", 400);
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error, user } = await requireUser(req, ["admin"]);
  if (error) return error;
  const id = Number((await ctx.params).id);
  try {
    await prisma.uom.delete({ where: { id } });
    await audit(user!.id, "delete", "uom", id);
    return json({ ok: true });
  } catch {
    return fail("Tidak bisa hapus (masih dipakai produk)", 409);
  }
}
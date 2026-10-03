import { prisma } from "@/lib/prisma";
import { audit, requireUser } from "@/lib/auth";
import { fail, json, money, options, readJson } from "@/lib/http";

export const OPTIONS = options;

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error, user } = await requireUser(req, ["admin"]);
  if (error) return error;

  const id = Number((await ctx.params).id);
  const b = await readJson<{
    name?: string;
    productId?: number | null;
    percent?: number | null;
    amount?: number | null;
    startDate?: string;
    endDate?: string;
  }>(req);

  const data: Record<string, any> = {};
  if (b.name !== undefined) data.name = b.name;
  if (b.productId !== undefined) data.productId = b.productId;
  if (b.percent !== undefined) data.percent = b.percent;
  if (b.amount !== undefined) data.amount = b.amount;
  if (b.startDate !== undefined) data.startDate = new Date(b.startDate);
  if (b.endDate !== undefined) data.endDate = new Date(b.endDate);

  const promo = await prisma.promo.update({ where: { id }, data });
  await audit(user!.id, "update", "promo", id);
  return json({ ...promo, percent: promo.percent ? money(promo.percent) : null, amount: promo.amount ? money(promo.amount) : null });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error, user } = await requireUser(req, ["admin"]);
  if (error) return error;

  const id = Number((await ctx.params).id);
  await prisma.promo.delete({ where: { id } });
  await audit(user!.id, "delete", "promo", id);
  return json({ ok: true });
}

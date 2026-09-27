import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { fail, json, money, options } from "@/lib/http";

export const OPTIONS = options;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireUser(req, ["admin", "kasir"]);
  if (error) return error;
  const id = Number((await ctx.params).id);
  const s = await prisma.sale.findUnique({
    where: { id },
    include: {
      items: { include: { product: { select: { id: true, sku: true, name: true } } } },
      user: { select: { id: true, username: true } },
    },
  });
  if (!s) return fail("Nota tidak ada", 404);
  return json({
    ...s,
    total: money(s.total),
    discount: money(s.discount),
    cashPaid: money(s.cashPaid),
    changeGiven: money(s.changeGiven),
    items: s.items.map((i) => ({ ...i, unitPrice: money(i.unitPrice), discount: money(i.discount) })),
  });
}

import { prisma } from "@/lib/prisma";
import { audit, requireUser } from "@/lib/auth";
import { fail, json, money, options, readJson } from "@/lib/http";
import type { PoStatus } from "@prisma/client";

export const OPTIONS = options;

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error, user } = await requireUser(req, ["admin", "gudang"]);
  if (error) return error;
  const id = Number((await ctx.params).id);
  const b = await readJson<{ status?: PoStatus; payAmount?: number }>(req);
  const po = await prisma.purchaseOrder.findUnique({ where: { id }, include: { items: true } });
  if (!po) return fail("PO tidak ada", 404);

  if (b.payAmount != null) {
    if (po.status !== "received") return fail("Hanya PO diterima yang bisa dibayar");
    const paid = money(po.paidAmount) + Number(b.payAmount);
    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: { paidAmount: Math.min(paid, money(po.totalAmount)) },
    });
    await audit(user!.id, "pay", "purchase_order", id);
    return json({ ...updated, totalAmount: money(updated.totalAmount), paidAmount: money(updated.paidAmount) });
  }

  if (!b.status) return fail("status wajib");
  if (po.status === "received" || po.status === "canceled") return fail("PO sudah final");

  if (b.status === "received") {
    if (user!.role === "kasir") return fail("Forbidden", 403);
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.purchaseOrder.update({ where: { id }, data: { status: "received" } });
      for (const it of po.items) {
        await tx.stockTx.create({
          data: { productId: it.productId, qtyChange: it.qty, refType: "purchase", refId: id },
        });
      }
      return u;
    });
    await audit(user!.id, "receive", "purchase_order", id);
    return json({ ...updated, totalAmount: money(updated.totalAmount) });
  }

  const updated = await prisma.purchaseOrder.update({ where: { id }, data: { status: b.status } });
  await audit(user!.id, "update", "purchase_order", id);
  return json({ ...updated, totalAmount: money(updated.totalAmount) });
}

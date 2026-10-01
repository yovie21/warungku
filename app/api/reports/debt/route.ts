import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { json, money, options } from "@/lib/http";

export const OPTIONS = options;

export async function GET(req: Request) {
  const { error } = await requireUser(req, ["admin", "gudang"]);
  if (error) return error;
  const rows = await prisma.purchaseOrder.findMany({
    where: { status: "received" },
    include: { supplier: { select: { name: true } } },
    orderBy: { id: "desc" },
  });
  const items = rows
    .map((p) => {
      const total = money(p.totalAmount);
      const paid = money(p.paidAmount);
      return {
        id: p.id,
        supplierName: p.supplier.name,
        total,
        paid,
        unpaid: Math.max(0, total - paid),
        orderDate: p.orderDate,
      };
    })
    .filter((p) => p.unpaid > 0);
  const totalHutang = items.reduce((s, i) => s + i.unpaid, 0);
  return json({ items, totalHutang });
}

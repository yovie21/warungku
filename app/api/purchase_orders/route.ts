import { prisma } from "@/lib/prisma";
import { audit, requireUser } from "@/lib/auth";
import { fail, json, money, options, readJson } from "@/lib/http";

export const OPTIONS = options;

type ItemIn = { productId: number; qty: number; unitPrice: number };

export async function GET(req: Request) {
  const { error } = await requireUser(req, ["admin", "gudang"]);
  if (error) return error;
  const rows = await prisma.purchaseOrder.findMany({
    include: { supplier: true, items: true },
    orderBy: { id: "desc" },
    take: 100,
  });
  return json(
    rows.map((p) => ({
      ...p,
      totalAmount: money(p.totalAmount),
      items: p.items.map((i) => ({ ...i, unitPrice: money(i.unitPrice) })),
    })),
  );
}

export async function POST(req: Request) {
  const { error, user } = await requireUser(req, ["admin"]);
  if (error) return error;
  const b = await readJson<{ supplierId?: number; orderDate?: string; items?: ItemIn[] }>(req);
  if (!b.supplierId || !b.items?.length) return fail("supplierId + items wajib");
  const total = b.items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  const po = await prisma.purchaseOrder.create({
    data: {
      supplierId: b.supplierId,
      orderDate: b.orderDate ? new Date(b.orderDate) : new Date(),
      status: "draft",
      totalAmount: total,
      items: { create: b.items.map((i) => ({ productId: i.productId, qty: i.qty, unitPrice: i.unitPrice })) },
    },
    include: { items: true, supplier: true },
  });
  await audit(user!.id, "create", "purchase_order", po.id);
  return json({ ...po, totalAmount: money(po.totalAmount) });
}

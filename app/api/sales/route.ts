import { prisma } from "@/lib/prisma";
import { audit, requireUser } from "@/lib/auth";
import { fail, json, money, options, readJson } from "@/lib/http";
import { addStock, stockOf } from "@/lib/stock";

export const OPTIONS = options;

type ItemIn = { productId: number; qty: number; unitPrice?: number; discount?: number };

export async function GET(req: Request) {
  const { error } = await requireUser(req, ["admin", "kasir"]);
  if (error) return error;
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const rows = await prisma.sale.findMany({
    where: {
      saleDate: {
        gte: from ? new Date(from) : undefined,
        lte: to ? new Date(to) : undefined,
      },
    },
    include: { items: true, user: { select: { id: true, username: true } } },
    orderBy: { id: "desc" },
    take: 200,
  });
  return json(
    rows.map((s) => ({
      ...s,
      total: money(s.total),
      discount: money(s.discount),
      cashPaid: money(s.cashPaid),
      changeGiven: money(s.changeGiven),
      items: s.items.map((i) => ({ ...i, unitPrice: money(i.unitPrice), discount: money(i.discount) })),
    })),
  );
}

export async function POST(req: Request) {
  const { error, user } = await requireUser(req, ["kasir", "admin"]);
  if (error) return error;
  const b = await readJson<{ items?: ItemIn[]; discount?: number; cashPaid?: number }>(req);
  const items = (b.items ?? []).filter((i) => i.productId && i.qty > 0);
  if (items.length === 0) return fail("items wajib");
  const uniq = new Set(items.map((i) => i.productId));
  if (uniq.size !== items.length) return fail("produk duplikat di struk");

  const products = await prisma.product.findMany({ where: { id: { in: items.map((i) => i.productId) } } });
  const byId = new Map(products.map((p) => [p.id, p]));

  let subtotal = 0;
  const prepared: { productId: number; qty: number; unitPrice: number; discount: number }[] = [];
  for (const it of items) {
    const p = byId.get(it.productId);
    if (!p) return fail(`Produk ${it.productId} tidak ada`);
    const stok = await stockOf(p.id);
    if (stok < it.qty) return fail(`Stok ${p.name} kurang (${stok})`);
    const unit = it.unitPrice ?? money(p.price);
    const disc = it.discount ?? 0;
    subtotal += unit * it.qty - disc;
    prepared.push({ productId: p.id, qty: it.qty, unitPrice: unit, discount: disc });
  }
  const discount = b.discount ?? 0;
  const total = Math.max(0, subtotal - discount);
  const cashPaid = b.cashPaid ?? total;
  if (cashPaid < total) return fail("Uang kurang");
  const changeGiven = cashPaid - total;

  const sale = await prisma.$transaction(async (tx) => {
    const s = await tx.sale.create({
      data: {
        userId: user!.id,
        total,
        discount,
        cashPaid,
        changeGiven,
        items: { create: prepared },
      },
      include: { items: true },
    });
    for (const it of prepared) {
      await tx.stockTx.create({
        data: { productId: it.productId, qtyChange: -it.qty, refType: "sale", refId: s.id },
      });
    }
    return s;
  });
  await audit(user!.id, "create", "sale", sale.id);
  return json({
    ...sale,
    total: money(sale.total),
    discount: money(sale.discount),
    cashPaid: money(sale.cashPaid),
    changeGiven: money(sale.changeGiven),
    items: sale.items.map((i) => ({ ...i, unitPrice: money(i.unitPrice), discount: money(i.discount) })),
  });
}

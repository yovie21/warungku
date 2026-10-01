import { prisma } from "@/lib/prisma";
import { audit, requireUser } from "@/lib/auth";
import { fail, json, money, options, readJson } from "@/lib/http";
import { nextInvoiceNo } from "@/lib/invoice";
import { stockOf } from "@/lib/stock";

export const OPTIONS = options;

type ItemIn = { productId: number; qty: number; unitPrice?: number; discount?: number; conversionFactor?: number; uomSymbol?: string };

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
  const methods = ["tunai", "qris", "transfer", "debit"] as const;
  type Pay = (typeof methods)[number];
  const b = await readJson<{ items?: ItemIn[]; discount?: number; cashPaid?: number; paymentMethod?: string }>(req);
  const items = (b.items ?? []).filter((i) => i.productId && i.qty > 0);
  if (items.length === 0) return fail("items wajib");

  const products = await prisma.product.findMany({ where: { id: { in: items.map((i) => i.productId) } } });
  const byId = new Map(products.map((p) => [p.id, p]));

  let subtotal = 0;
  const need = new Map<number, number>();
  const prepared: { productId: number; qty: number; unitPrice: number; discount: number; baseQty: number; uomSymbol: string | null; conversionFactor: number }[] = [];
  for (const it of items) {
    const p = byId.get(it.productId);
    if (!p) return fail(`Produk ${it.productId} tidak ada`);
    const factor = it.conversionFactor ?? 1;
    const baseQtyNeeded = it.qty * factor;
    need.set(p.id, (need.get(p.id) ?? 0) + baseQtyNeeded);
    const unit = it.unitPrice ?? money(p.price);
    const disc = it.discount ?? 0;
    subtotal += unit * it.qty - disc;
    prepared.push({
      productId: p.id,
      qty: it.qty,
      unitPrice: unit,
      discount: disc,
      baseQty: baseQtyNeeded,
      uomSymbol: it.uomSymbol ?? null,
      conversionFactor: factor,
    });
  }
  for (const [productId, baseQty] of need) {
    const p = byId.get(productId)!;
    const stok = await stockOf(productId);
    if (stok < baseQty) return fail(`Stok ${p.name} kurang (${stok} < butuh ${baseQty})`);
  }
  const discount = b.discount ?? 0;
  const total = Math.max(0, subtotal - discount);
  const method: Pay = methods.includes(b.paymentMethod as Pay) ? (b.paymentMethod as Pay) : "tunai";
  const cashPaid = method === "tunai" ? (b.cashPaid ?? total) : total;
  if (method === "tunai" && cashPaid < total) return fail("Uang kurang");
  const changeGiven = method === "tunai" ? cashPaid - total : 0;

  const sale = await prisma.$transaction(async (tx) => {
    const invoiceNo = await nextInvoiceNo(tx);
    const s = await tx.sale.create({
      data: {
        invoiceNo,
        userId: user!.id,
        total,
        discount,
        cashPaid,
        changeGiven,
        paymentMethod: method,
        items: {
          create: prepared.map((p) => ({
            productId: p.productId,
            qty: p.qty,
            unitPrice: p.unitPrice,
            discount: p.discount,
            uomSymbol: p.uomSymbol,
            conversionFactor: p.conversionFactor,
          })),
        },
      },
      include: { items: true },
    });
    for (const it of prepared) {
      await tx.stockTx.create({
        data: { productId: it.productId, qtyChange: -it.baseQty, refType: "sale", refId: s.id },
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

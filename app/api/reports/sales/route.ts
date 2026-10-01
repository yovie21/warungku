import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { fail, json, money, options } from "@/lib/http";

export const OPTIONS = options;

export async function GET(req: Request) {
  const { error, user } = await requireUser(req, ["admin", "kasir"]);
  if (error) return error;
  const url = new URL(req.url);
  const from = url.searchParams.get("from") ? new Date(url.searchParams.get("from")!) : undefined;
  const to = url.searchParams.get("to") ? new Date(url.searchParams.get("to")!) : undefined;
  const orderBy = { saleDate: "asc" } as const;
  const rows = await prisma.sale.findMany({
  where: { saleDate: { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } },
  include: { items: { include: { product: true } }, user: { select: { username: true } } },
  orderBy,
  take: 200,
  });
  let totalRevenue = 0,
  totalCost = 0,
  totalDiscount = 0,
  totalCash = 0,
  count = 0;
  for (const s of rows) {
  totalRevenue += money(s.total);
  totalDiscount += money(s.discount);
  totalCash += money(s.cashPaid);
  count++;
  for (const it of s.items) {
    const factor = it.conversionFactor ?? 1;
    totalCost += money(it.product.costPrice) * it.qty * factor;
  }
  }
  return json({
  periode: { from, to },
  totalPenjualan: totalRevenue,
  totalDiskon: totalDiscount,
  totalCash,
  totalHargaPokok: totalCost,
  labaKotor: totalRevenue - totalCost,
  transaksi: count,
  });
  }
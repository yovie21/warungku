import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { fail, json, money, options } from "@/lib/http";

export const OPTIONS = options;

export async function GET(req: Request) {
  const { error, user } = await requireUser(req, ["admin"]);
  if (error) return error;
  const url = new URL(req.url);
  const from = url.searchParams.get("from") ? new Date(url.searchParams.get("from")!) : undefined;
  const to = url.searchParams.get("to") ? new Date(url.searchParams.get("to")!) : undefined;
  const rows = await prisma.sale.findMany({
    where: { saleDate: { gte: from, lte: to } },
    include: { items: { include: { product: { select: { costPrice: true } } } }, user: { select: { username: true } } },
    orderBy: { saleDate: "asc" },
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
      totalCost += money(it.product.costPrice) * it.qty;
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
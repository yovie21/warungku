import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { fail, json, money, options } from "@/lib/http";

export const OPTIONS = options;

export async function GET(req: Request) {
  const { error, user } = await requireUser(req, ["admin", "gudang"]);
  if (error) return error;
  const products = await prisma.product.findMany({ include: { category: true, uom: true } });
  const stocks = await prisma.stockTx.groupBy({ by: ["productId"], _sum: { qtyChange: true } });
  const map = new Map(stocks.map((s) => [s.productId, s._sum.qtyChange ?? 0]));
  return json(
    products
      .map((p) => ({ ...p, price: money(p.price), costPrice: money(p.costPrice), stock: map.get(p.id) ?? 0 }))
      .filter((p) => (p.stock ?? 0) <= (p.minStock ?? 0)),
  );
}
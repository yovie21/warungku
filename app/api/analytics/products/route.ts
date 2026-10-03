import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { json, money, options } from "@/lib/http";

export const OPTIONS = options;

export async function GET(req: Request) {
  const { error } = await requireUser(req, ["admin"]);
  if (error) return error;

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const where: any = {};
  if (from) where.saleDate = { gte: new Date(from) };
  if (to) where.saleDate = { ...where.saleDate, lte: new Date(to) };

  // Top 10 produk terlaris
  const items = await prisma.saleItem.findMany({
    where: { sale: where },
    include: { product: { select: { name: true, costPrice: true } }, sale: { select: { saleDate: true } } },
  });

  const productMap = new Map<number, { name: string; qty: number; revenue: number; profit: number }>();
  items.forEach((it) => {
    const pid = it.productId;
    const existing = productMap.get(pid) || { name: it.product.name, qty: 0, revenue: 0, profit: 0 };
    const rev = money(it.unitPrice) * it.qty - money(it.discount);
    const cost = money(it.product.costPrice) * it.qty * it.conversionFactor;
    existing.qty += it.qty * it.conversionFactor;
    existing.revenue += rev;
    existing.profit += rev - cost;
    productMap.set(pid, existing);
  });

  const topProducts = Array.from(productMap.entries())
    .map(([id, data]) => ({ productId: id, ...data }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  // Produk slow-moving (tidak terjual sama sekali dalam periode)
  const soldIds = new Set(productMap.keys());
  const allProducts = await prisma.product.findMany({ select: { id: true, name: true } });
  const slowMoving = allProducts.filter((p) => !soldIds.has(p.id)).slice(0, 10);

  return json({ topProducts, slowMoving });
}

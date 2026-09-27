import { prisma } from "@/lib/prisma";
import type { StockRef } from "@prisma/client";

export async function stockOf(productId: number) {
  const agg = await prisma.stockTx.aggregate({
    where: { productId },
    _sum: { qtyChange: true },
  });
  return agg._sum.qtyChange ?? 0;
}

export async function stockMap(ids: number[]) {
  if (ids.length === 0) return new Map<number, number>();
  const rows = await prisma.stockTx.groupBy({
    by: ["productId"],
    where: { productId: { in: ids } },
    _sum: { qtyChange: true },
  });
  const m = new Map<number, number>();
  for (const r of rows) m.set(r.productId, r._sum.qtyChange ?? 0);
  return m;
}

export async function addStock(productId: number, qtyChange: number, refType: StockRef, refId?: number) {
  return prisma.stockTx.create({
    data: { productId, qtyChange, refType, refId: refId ?? null },
  });
}

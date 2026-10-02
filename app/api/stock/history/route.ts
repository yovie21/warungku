import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { json, options } from "@/lib/http";

export const OPTIONS = options;

export async function GET(req: Request) {
  const { error } = await requireUser(req, ["admin", "gudang"]);
  if (error) return error;

  const url = new URL(req.url);
  const productId = url.searchParams.get("productId");
  const limit = Math.min(Number(url.searchParams.get("limit") || 100), 200);

  const where: { productId?: number } = {};
  if (productId) {
    where.productId = Number(productId);
  }

  const list = await prisma.stockTx.findMany({
    where,
    include: {
      product: {
        select: { id: true, name: true, sku: true, barcode: true, uom: { select: { name: true, symbol: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return json(list);
}

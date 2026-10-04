import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { json, options } from "@/lib/http";

export const OPTIONS = options;

export async function GET(req: Request) {
  const { error } = await requireUser(req, ["gudang", "admin"]);
  if (error) return error;
  
  const productId = Number(new URL(req.url).searchParams.get("productId"));
  const rows = await prisma.stockTx.findMany({
    where: productId ? { productId } : undefined,
    include: { product: { select: { name: true, sku: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return json({
    history: rows.map((r) => ({
      id: r.id,
      qtyChange: r.qtyChange,
      refType: r.refType,
      refId: r.refId,
      createdAt: r.createdAt,
      product: r.product,
    })),
  });
}

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { fail, json, options } from "@/lib/http";

export const OPTIONS = options;

export async function GET(req: Request) {
  const { error } = await requireUser(req, ["gudang", "admin"]);
  if (error) return error;
  
  const productId = Number(new URL(req.url).searchParams.get("productId"));
  if (!productId) return fail("productId wajib");
  
  const rows = await prisma.stockTx.findMany({
    where: { productId },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return fail("Produk tidak ada", 404);
  
  return json({
    product: { id: product.id, name: product.name, sku: product.sku },
    history: rows.map((r) => ({
      id: r.id,
      qtyChange: r.qtyChange,
      refType: r.refType,
      refId: r.refId,
      createdAt: r.createdAt,
    })),
  });
}

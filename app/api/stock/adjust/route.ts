import { prisma } from "@/lib/prisma";
import { audit, requireUser } from "@/lib/auth";
import { fail, json, options, readJson } from "@/lib/http";
import { addStock, stockOf } from "@/lib/stock";

export const OPTIONS = options;

export async function POST(req: Request) {
  const { error, user } = await requireUser(req, ["gudang", "admin"]);
  if (error) return error;
  const b = await readJson<{ productId?: number; qtyChange?: number; note?: string }>(req);
  if (!b.productId || !b.qtyChange) return fail("productId + qtyChange wajib");
  const p = await prisma.product.findUnique({ where: { id: b.productId } });
  if (!p) return fail("Produk tidak ada", 404);
  const tx = await addStock(b.productId, b.qtyChange, "adjust");
  await audit(user!.id, "adjust", "stock", p.id);
  return json({ tx, stock: await stockOf(b.productId) });
}

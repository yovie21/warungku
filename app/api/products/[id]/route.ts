import { prisma } from "@/lib/prisma";
import { audit, requireUser } from "@/lib/auth";
import { fail, json, money, options, readJson } from "@/lib/http";
import { stockOf } from "@/lib/stock";

export const OPTIONS = options;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireUser(req);
  if (error) return error;
  const id = Number((await ctx.params).id);
  const p = await prisma.product.findUnique({ where: { id }, include: { category: true, uom: true } });
  if (!p) return fail("Produk tidak ada", 404);
  return json({ ...p, price: money(p.price), costPrice: money(p.costPrice), stock: await stockOf(id) });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error, user } = await requireUser(req, ["admin"]);
  if (error) return error;
  const id = Number((await ctx.params).id);
  const b = await readJson<Record<string, any>>(req);
  const data: Record<string, unknown> = {};
  for (const k of ["sku", "name", "barcode", "categoryId", "uomId", "price", "costPrice", "minStock"] as const) {
    if (k in b) data[k] = b[k];
  }
  try {
    const p = await prisma.product.update({ where: { id }, data });
    if (Array.isArray(b.productUoms)) {
      await prisma.productUom.deleteMany({ where: { productId: id } });
      if (b.productUoms.length > 0) {
        await prisma.productUom.createMany({
          data: b.productUoms.map((u: any) => ({
            productId: id,
            uomId: Number(u.uomId),
            conversionFactor: Number(u.conversionFactor || 1),
            price: Number(u.price || 0),
          })),
        });
      }
    }
    await audit(user!.id, "update", "product", id);
    return json({ ...p, price: money(p.price), costPrice: money(p.costPrice) });
  } catch {
    return fail("Gagal update", 400);
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error, user } = await requireUser(req, ["admin"]);
  if (error) return error;
  const id = Number((await ctx.params).id);
  try {
    await prisma.$transaction([
      prisma.stockTx.deleteMany({ where: { productId: id } }),
      prisma.saleItem.deleteMany({ where: { productId: id } }),
      prisma.purchaseItem.deleteMany({ where: { productId: id } }),
      prisma.product.delete({ where: { id } }),
    ]);
    await audit(user!.id, "delete", "product", id);
    return json({ ok: true });
  } catch {
    return fail("Gagal hapus produk", 400);
  }
}

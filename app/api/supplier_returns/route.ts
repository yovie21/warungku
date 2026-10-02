import { prisma } from "@/lib/prisma";
import { audit, requireUser } from "@/lib/auth";
import { fail, json, options, readJson } from "@/lib/http";
import { addStock } from "@/lib/stock";

export const OPTIONS = options;

export async function GET(req: Request) {
  const { error } = await requireUser(req, ["gudang", "admin"]);
  if (error) return error;

  const rows = await prisma.supplierReturn.findMany({
    include: {
      supplier: { select: { id: true, name: true } },
      product: { select: { id: true, name: true, sku: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return json(rows);
}

export async function POST(req: Request) {
  const { error, user } = await requireUser(req, ["gudang", "admin"]);
  if (error) return error;

  const b = await readJson<{
    supplierId?: number;
    productId?: number;
    qty?: number;
    reason?: string;
    deductDebt?: boolean;
  }>(req);

  if (!b.supplierId || !b.productId || !b.qty || b.qty <= 0) {
    return fail("supplierId, productId, dan qty valid wajib diisi");
  }

  const p = await prisma.product.findUnique({ where: { id: b.productId } });
  if (!p) return fail("Produk tidak ditemukan", 404);

  const ret = await prisma.$transaction(async (tx) => {
    const created = await tx.supplierReturn.create({
      data: {
        supplierId: b.supplierId!,
        productId: b.productId!,
        qty: b.qty!,
        reason: b.reason?.trim() ?? "Retur barang rusak/cacat",
        deductDebt: b.deductDebt ?? true,
      },
      include: {
        supplier: { select: { name: true } },
        product: { select: { name: true } },
      },
    });

    // Kurangi stok barang karena dikembalikan ke supplier
    await tx.stockTx.create({
      data: {
        productId: b.productId!,
        qtyChange: -Math.abs(b.qty!),
        refType: "return",
        refId: created.id,
      },
    });

    return created;
  });

  await audit(user!.id, "create", "supplier_return", ret.id);
  return json(ret);
}

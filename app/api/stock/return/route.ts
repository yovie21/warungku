import { prisma } from "@/lib/prisma";
import { audit, requireUser } from "@/lib/auth";
import { fail, json, money, options, readJson } from "@/lib/http";
import { addStock, stockOf } from "@/lib/stock";

export const OPTIONS = options;

export async function GET(req: Request) {
  const { error } = await requireUser(req, ["admin", "gudang"]);
  if (error) return error;

  // Retrieve returns from audit log & stock transactions
  const logs = await prisma.auditLog.findMany({
    where: { action: "return_supplier" },
    include: { user: { select: { username: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return json(logs);
}

export async function POST(req: Request) {
  const { error, user } = await requireUser(req, ["admin", "gudang"]);
  if (error) return error;

  const b = await readJson<{
    productId?: number;
    supplierId?: number;
    qty?: number;
    reason?: string;
    note?: string;
  }>(req);

  if (!b.productId || !b.qty || b.qty <= 0) {
    return fail("Produk dan jumlah (qty) wajib diisi");
  }

  const p = await prisma.product.findUnique({ where: { id: b.productId } });
  if (!p) return fail("Produk tidak ditemukan", 404);

  const currentStock = await stockOf(b.productId);
  if (currentStock < b.qty) {
    return fail(`Stok tidak mencukupi untuk retur (stok saat ini: ${currentStock})`, 400);
  }

  const supplier = b.supplierId
    ? await prisma.supplier.findUnique({ where: { id: b.supplierId } })
    : null;

  // Reduce stock by negative transaction
  const tx = await addStock(b.productId, -b.qty, "adjust");

  const returnDetails = JSON.stringify({
    productId: p.id,
    productName: p.name,
    sku: p.sku,
    qty: b.qty,
    supplierId: supplier?.id ?? null,
    supplierName: supplier?.name ?? "Umum",
    reason: b.reason || "Barang Rusak / Kadaluarsa",
    note: b.note || "",
    refundEstimate: money(p.costPrice) * b.qty,
  });

  await audit(user!.id, "return_supplier", returnDetails, p.id);

  return json({
    success: true,
    message: `Retur ${b.qty} unit ${p.name} berhasil dicatat`,
    tx,
    stock: await stockOf(b.productId),
  });
}

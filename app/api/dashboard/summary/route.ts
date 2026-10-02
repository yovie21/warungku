import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { json, money, options } from "@/lib/http";

export const OPTIONS = options;

export async function GET(req: Request) {
  const { error } = await requireUser(req);
  if (error) return error;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Omzet hari ini
  const sales = await prisma.sale.findMany({
    where: { saleDate: { gte: today } },
  });
  const omzet = sales.reduce((sum, s) => sum + money(s.total), 0);
  const txCount = sales.length;

  // Stok habis + menipis
  const products = await prisma.product.findMany({ include: { stockTx: true } });
  let habis = 0;
  let menipis = 0;
  products.forEach((p) => {
    const stok = p.stockTx.reduce((sum, tx) => sum + tx.qtyChange, 0);
    if (stok === 0) habis++;
    else if (p.minStock > 0 && stok <= p.minStock) menipis++;
  });

  // Hutang supplier jatuh tempo
  const pos = await prisma.purchaseOrder.findMany({
    where: { status: "received" },
    include: { supplier: true },
  });
  const hutang = pos
    .filter((p) => money(p.totalAmount) > money(p.paidAmount))
    .length;

  return json({
    omzet,
    txCount,
    habis,
    menipis,
    hutang,
  });
}

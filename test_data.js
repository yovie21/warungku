const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const pos = await prisma.purchaseOrder.findMany({ select: { id: true, poNo: true } });
  console.log("POS:", pos);
  const sales = await prisma.sale.findMany({ select: { id: true, invoiceNo: true } });
  console.log("SALES:", sales);
  const prods = await prisma.product.findMany({ select: { id: true, name: true, sku: true } });
  console.log("PRODS:", prods);
}
main().finally(() => prisma.$disconnect());

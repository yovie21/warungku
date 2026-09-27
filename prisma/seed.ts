import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

async function main() {
  // users
  const pw = await hashPassword("password123");
  await prisma.user.upsert({
    where: { username: "admin" },
    create: { username: "admin", passwordHash: pw, role: "admin" },
    update: {},
  });
  await prisma.user.upsert({
    where: { username: "kasir" },
    create: { username: "kasir", passwordHash: pw, role: "kasir" },
    update: {},
  });
  await prisma.user.upsert({
    where: { username: "gudang" },
    create: { username: "gudang", passwordHash: pw, role: "gudang" },
    update: {},
  });

  // uom
  const u1 = await prisma.uom.upsert({
    where: { id: 1 },
    create: { name: "PCS", symbol: "pcs" },
    update: { name: "PCS", symbol: "pcs" },
  });
  const u2 = await prisma.uom.upsert({
    where: { id: 2 },
    create: { name: "DUS", symbol: "dus" },
    update: { name: "DUS", symbol: "dus" },
  });

  // category
  const c1 = await prisma.category.upsert({
    where: { id: 1 },
    create: { name: "Makanan" },
    update: { name: "Makanan" },
  });
  const c2 = await prisma.category.upsert({
    where: { id: 2 },
    create: { name: "Minuman" },
    update: { name: "Minuman" },
  });

  // products
  await prisma.product.upsert({
    where: { sku: "BRG001" },
    create: { sku: "BRG001", name: "Indomie Goreng", categoryId: c1.id, uomId: u1.id, price: 3500, costPrice: 2800, minStock: 10 },
    update: {},
  });
  await prisma.product.upsert({
    where: { sku: "BRG002" },
    create: { sku: "BRG002", name: "Teh Botol", categoryId: c2.id, uomId: u1.id, price: 5000, costPrice: 4000, minStock: 5 },
    update: {},
  });
  await prisma.product.upsert({
    where: { sku: "BRG003" },
    create: { sku: "BRG003", name: "Rokok Sampoerna", categoryId: c1.id, uomId: u2.id, price: 25000, costPrice: 22000, minStock: 3 },
    update: {},
  });

  // supplier
  await prisma.supplier.upsert({
    where: { id: 1 },
    create: { name: "PT Sumber Makmur", contact: "Budi", phone: "08123456789", email: "budi@sumbermakmur.co.id" },
    update: {},
  });

  console.log("Seed selesai");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
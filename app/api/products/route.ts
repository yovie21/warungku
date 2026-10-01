import { prisma } from "@/lib/prisma";
import { audit, requireUser } from "@/lib/auth";
import { fail, json, money, options, readJson } from "@/lib/http";
import { stockMap } from "@/lib/stock";

export const OPTIONS = options;

export async function GET(req: Request) {
  const { error } = await requireUser(req);
  if (error) return error;
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  const rows = await prisma.product.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q } },
            { sku: { contains: q } },
            { barcode: { contains: q } },
          ],
        }
      : undefined,
    include: { category: true, uom: true, productUoms: { include: { uom: true } } },
    orderBy: { id: "desc" },
    take: 200,
  });
  const stocks = await stockMap(rows.map((p) => p.id));
  return json(
    rows.map((p) => ({
      ...p,
      price: money(p.price),
      costPrice: money(p.costPrice),
      stock: stocks.get(p.id) ?? 0,
      productUoms: p.productUoms.map((pu) => ({
        ...pu,
        price: money(pu.price),
      })),
    })),
  );
}

export async function POST(req: Request) {
  const { error, user } = await requireUser(req, ["admin"]);
  if (error) return error;
  const b = await readJson<{
    sku?: string;
    name?: string;
    barcode?: string | null;
    categoryId?: number | null;
    uomId?: number | null;
    price?: number;
    costPrice?: number;
    minStock?: number;
    initialStock?: number;
    productUoms?: { uomId: number; conversionFactor: number; price: number }[];
  }>(req);
  if (!b.sku || !b.name || b.price == null || b.costPrice == null) return fail("sku, name, price, costPrice wajib");
  try {
    const p = await prisma.product.create({
      data: {
        sku: b.sku.trim(),
        name: b.name.trim(),
        barcode: b.barcode?.trim() || null,
        categoryId: b.categoryId ?? null,
        uomId: b.uomId ?? null,
        price: b.price,
        costPrice: b.costPrice,
        minStock: b.minStock ?? 0,
      },
    });
    const initial = Number(b.initialStock) || 0;
    if (initial > 0) {
      await prisma.stockTx.create({
        data: { productId: p.id, qtyChange: initial, refType: "adjust", refId: null },
      });
    }
    if (Array.isArray(b.productUoms) && b.productUoms.length > 0) {
      await prisma.productUom.createMany({
        data: b.productUoms.map((u) => ({
          productId: p.id,
          uomId: Number(u.uomId),
          conversionFactor: Number(u.conversionFactor || 1),
          price: Number(u.price || 0),
        })),
      });
    }
    await audit(user!.id, "create", "product", p.id);
    return json({ ...p, price: money(p.price), costPrice: money(p.costPrice), stock: initial });
  } catch {
    return fail("SKU/barcode sudah ada", 409);
  }
}

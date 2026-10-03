import { prisma } from "@/lib/prisma";
import { audit, requireUser } from "@/lib/auth";
import { fail, json, options, readJson } from "@/lib/http";

export const OPTIONS = options;

type Row = {
  sku?: string;
  name?: string;
  barcode?: string | null;
  price?: number;
  costPrice?: number;
  minStock?: number;
  initialStock?: number;
};

export async function POST(req: Request) {
  const { error, user } = await requireUser(req, ["admin"]);
  if (error) return error;
  const b = await readJson<{ rows?: Row[] }>(req);
  const rows = (b.rows ?? []).filter((r) => r.sku && r.name && r.price != null && r.costPrice != null);
  if (rows.length === 0) return fail("rows wajib: sku, name, price, costPrice");

  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const r of rows) {
    const sku = String(r.sku).trim();
    const name = String(r.name).trim();
    const barcode = r.barcode?.trim() || null;
    try {
      const existing = await prisma.product.findUnique({ where: { sku } });
      if (existing) {
        await prisma.product.update({
          where: { id: existing.id },
          data: { name, barcode, price: r.price, costPrice: r.costPrice, minStock: r.minStock ?? existing.minStock },
        });
        updated++;
      } else {
        const p = await prisma.product.create({
          data: {
            sku,
            name,
            barcode,
            price: r.price!,
            costPrice: r.costPrice!,
            minStock: r.minStock ?? 0,
          },
        });
        const initial = Number(r.initialStock) || 0;
        if (initial > 0) {
          await prisma.stockTx.create({ data: { productId: p.id, qtyChange: initial, refType: "adjust" } });
        }
        created++;
      }
    } catch (e) {
      errors.push(`${sku}: ${e instanceof Error ? e.message : "gagal"}`);
    }
  }

  await audit(user!.id, "import", "product");
  return json({ created, updated, failed: errors.length, errors: errors.slice(0, 20) });
}

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { json, options } from "@/lib/http";

export const OPTIONS = options;

export async function GET(req: Request) {
  const { error } = await requireUser(req, ["admin"]);
  if (error) return error;

  const rows = await prisma.auditLog.findMany({
    include: { user: { select: { username: true, role: true } } },
    orderBy: { id: "desc" },
    take: 200,
  });

  const saleIds = rows.filter((r) => r.entity === "sale" && r.entityId).map((r) => r.entityId!);
  const poIds = rows.filter((r) => r.entity === "purchase_order" && r.entityId).map((r) => r.entityId!);
  const prodIds = rows.filter((r) => r.entity === "product" && r.entityId).map((r) => r.entityId!);
  const retIds = rows.filter((r) => r.entity === "supplier_return" && r.entityId).map((r) => r.entityId!);

  const [sales, pos, prods, rets] = await Promise.all([
    saleIds.length
      ? prisma.sale.findMany({ where: { id: { in: saleIds } }, select: { id: true, invoiceNo: true } })
      : [],
    poIds.length
      ? prisma.purchaseOrder.findMany({ where: { id: { in: poIds } }, select: { id: true, poNo: true } })
      : [],
    prodIds.length
      ? prisma.product.findMany({ where: { id: { in: prodIds } }, select: { id: true, name: true, sku: true } })
      : [],
    retIds.length
      ? prisma.supplierReturn.findMany({
          where: { id: { in: retIds } },
          select: { id: true, createdAt: true, product: { select: { name: true } } },
        })
      : [],
  ]);

  const saleMap = new Map(sales.map((s) => [s.id, s.invoiceNo]));
  const poMap = new Map(pos.map((p) => [p.id, p.poNo]));
  const prodMap = new Map(prods.map((p) => [p.id, p.name]));
  const retMap = new Map(
    rets.map((r) => {
      const d = new Date(r.createdAt).toISOString().slice(0, 10).replace(/-/g, "");
      const seq = String(r.id % 1000).padStart(3, "0");
      return [r.id, `RET-${d}-${seq} (${r.product.name})`];
    })
  );

  const result = rows.map((r) => {
    let refNo = r.entityId ? `#${r.entityId}` : "";
    if (r.entity === "sale" && r.entityId && saleMap.has(r.entityId)) {
      refNo = saleMap.get(r.entityId) || refNo;
    } else if (r.entity === "purchase_order" && r.entityId && poMap.has(r.entityId)) {
      refNo = poMap.get(r.entityId) || refNo;
    } else if (r.entity === "product" && r.entityId && prodMap.has(r.entityId)) {
      refNo = prodMap.get(r.entityId) || refNo;
    } else if (r.entity === "supplier_return" && r.entityId && retMap.has(r.entityId)) {
      refNo = retMap.get(r.entityId) || refNo;
    }
    return {
      ...r,
      refNo,
    };
  });

  return json(result);
}

import { prisma } from "@/lib/prisma";
import { audit, requireUser } from "@/lib/auth";
import { fail, json, money, options, readJson } from "@/lib/http";

export const OPTIONS = options;

export async function GET(req: Request) {
  const { error } = await requireUser(req);
  if (error) return error;
  const now = new Date();
  const active = new URL(req.url).searchParams.get("active") === "1";
  const rows = await prisma.promo.findMany({
    where: active ? { startDate: { lte: now }, endDate: { gte: now } } : undefined,
    include: { product: { select: { id: true, name: true, sku: true } } },
    orderBy: { id: "desc" },
  });
  return json(
    rows.map((p) => ({
      ...p,
      percent: p.percent != null ? money(p.percent) : null,
      amount: p.amount != null ? money(p.amount) : null,
    })),
  );
}

export async function POST(req: Request) {
  const { error, user } = await requireUser(req, ["admin"]);
  if (error) return error;
  const b = await readJson<{
    name?: string;
    productId?: number | null;
    percent?: number | null;
    amount?: number | null;
    startDate?: string;
    endDate?: string;
  }>(req);
  if (!b.name || !b.startDate || !b.endDate) return fail("name, startDate, endDate wajib");
  const p = await prisma.promo.create({
    data: {
      name: b.name.trim(),
      productId: b.productId ?? null,
      percent: b.percent ?? null,
      amount: b.amount ?? null,
      startDate: new Date(b.startDate),
      endDate: new Date(b.endDate),
    },
  });
  await audit(user!.id, "create", "promo", p.id);
  return json(p);
}

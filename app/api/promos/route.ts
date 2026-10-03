import { prisma } from "@/lib/prisma";
import { audit, requireUser } from "@/lib/auth";
import { fail, json, money, options, readJson } from "@/lib/http";

export const OPTIONS = options;

export async function GET(req: Request) {
  const { error } = await requireUser(req, ["admin"]);
  if (error) return error;

  const now = new Date();
  const rows = await prisma.promo.findMany({
    include: { product: { select: { id: true, name: true } } },
    orderBy: { endDate: "asc" },
  });

  return json(
    rows.map((p) => ({
      ...p,
      percent: p.percent ? money(p.percent) : null,
      amount: p.amount ? money(p.amount) : null,
      status: new Date(p.endDate) < now ? "expired" : new Date(p.startDate) > now ? "scheduled" : "active",
    }))
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

  if (!b.name || !b.startDate || !b.endDate) {
    return fail("name, startDate, endDate wajib");
  }

  if (!b.percent && !b.amount) {
    return fail("Harus ada percent atau amount");
  }

  const promo = await prisma.promo.create({
    data: {
      name: b.name,
      productId: b.productId ?? null,
      percent: b.percent ?? null,
      amount: b.amount ?? null,
      startDate: new Date(b.startDate),
      endDate: new Date(b.endDate),
    },
  });

  await audit(user!.id, "create", "promo", promo.id);
  return json({ ...promo, percent: promo.percent ? money(promo.percent) : null, amount: promo.amount ? money(promo.amount) : null });
}

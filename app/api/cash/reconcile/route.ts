import { prisma } from "@/lib/prisma";
import { audit, requireUser } from "@/lib/auth";
import { fail, json, money, options, readJson } from "@/lib/http";

export const OPTIONS = options;

function dayRange(iso: string) {
  const start = new Date(`${iso}T00:00:00+07:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export async function GET(req: Request) {
  const { error } = await requireUser(req, ["admin", "kasir"]);
  if (error) return error;
  const date = new URL(req.url).searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const { start, end } = dayRange(date);

  const sales = await prisma.sale.findMany({
    where: { saleDate: { gte: start, lt: end }, paymentMethod: "tunai" },
  });
  const expected = sales.reduce((s, x) => s + money(x.total), 0);
  const rows = await prisma.cashReconcile.findMany({
    where: { bizDate: start },
    include: { user: { select: { username: true } } },
    orderBy: { id: "desc" },
  });

  return json({
    date,
    expected,
    txCount: sales.length,
    rows: rows.map((r) => ({
      ...r,
      expected: money(r.expected),
      counted: money(r.counted),
      diff: money(r.diff),
    })),
  });
}

export async function POST(req: Request) {
  const { error, user } = await requireUser(req, ["admin", "kasir"]);
  if (error) return error;
  const b = await readJson<{ date?: string; counted?: number; note?: string }>(req);
  if (b.counted == null || Number.isNaN(Number(b.counted))) return fail("counted wajib");
  const date = b.date || new Date().toISOString().slice(0, 10);
  const { start, end } = dayRange(date);
  const sales = await prisma.sale.findMany({
    where: { saleDate: { gte: start, lt: end }, paymentMethod: "tunai" },
  });
  const expected = sales.reduce((s, x) => s + money(x.total), 0);
  const counted = Number(b.counted);
  const diff = counted - expected;
  const row = await prisma.cashReconcile.create({
    data: { userId: user!.id, bizDate: start, expected, counted, diff, note: b.note?.slice(0, 200) || null },
  });
  await audit(user!.id, "create", "cash_reconcile", row.id);
  return json({ ...row, expected, counted, diff });
}

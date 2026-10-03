import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { json, money, options } from "@/lib/http";

export const OPTIONS = options;

export async function GET(req: Request) {
  const { error } = await requireUser(req, ["admin"]);
  if (error) return error;

  const url = new URL(req.url);
  const from = url.searchParams.get("from") || new Date(new Date().setDate(1)).toISOString().split("T")[0];
  const to = url.searchParams.get("to") || new Date().toISOString().split("T")[0];

  const sales = await prisma.sale.findMany({
    where: {
      saleDate: { gte: new Date(from), lte: new Date(to) },
    },
  });

  const total = sales.reduce((sum, s) => sum + money(s.total), 0);
  const discount = sales.reduce((sum, s) => sum + money(s.discount), 0);
  const cashPaid = sales.reduce((sum, s) => sum + money(s.cashPaid), 0);
  const change = sales.reduce((sum, s) => sum + money(s.changeGiven), 0);
  const txCount = sales.length;

  // Daily breakdown
  const daily = new Map<string, { date: string; count: number; total: number }>();
  sales.forEach((s) => {
    const d = s.saleDate.toISOString().split("T")[0];
    const existing = daily.get(d) || { date: d, count: 0, total: 0 };
    existing.count++;
    existing.total += money(s.total);
    daily.set(d, existing);
  });

  // Payment method breakdown
  const payments = new Map<string, number>();
  sales.forEach((s) => {
    const m = s.paymentMethod as string;
    payments.set(m, (payments.get(m) || 0) + money(s.total));
  });

  return json({
    summary: { total, discount, cashPaid, change, txCount, from, to },
    daily: Array.from(daily.values()).sort((a, b) => a.date.localeCompare(b.date)),
    payments: Object.fromEntries(payments),
  });
}

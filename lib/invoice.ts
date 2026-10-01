import type { Prisma } from "@prisma/client";

export function jakartaYmd(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(d)
    .replaceAll("-", "");
}

export async function nextInvoiceNo(tx: Prisma.TransactionClient, at = new Date()) {
  const prefix = `WK-${jakartaYmd(at)}-`;
  const last = await tx.sale.findFirst({
    where: { invoiceNo: { startsWith: prefix } },
    orderBy: { invoiceNo: "desc" },
    select: { invoiceNo: true },
  });
  const n = last?.invoiceNo ? Number.parseInt(last.invoiceNo.slice(prefix.length), 10) : 0;
  const seq = Number.isFinite(n) ? n + 1 : 1;
  return `${prefix}${String(seq).padStart(3, "0")}`;
}

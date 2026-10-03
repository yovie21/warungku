import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { money, options } from "@/lib/http";

export const OPTIONS = options;

function esc(s: unknown) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function rp(n: number) {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

export async function GET(req: Request) {
  const { error } = await requireUser(req, ["admin", "kasir"]);
  if (error) return error;
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") || "sales";
  const from = url.searchParams.get("from") || new Date().toISOString().slice(0, 10);
  const to = url.searchParams.get("to") || from;

  let title = "Laporan";
  let head = "";
  let body = "";

  if (kind === "sales") {
    title = `Laporan Penjualan ${from} s/d ${to}`;
    const sales = await prisma.sale.findMany({
      where: { saleDate: { gte: new Date(from), lte: new Date(`${to}T23:59:59+07:00`) } },
      include: { user: { select: { username: true } } },
      orderBy: { id: "asc" },
      take: 500,
    });
    const total = sales.reduce((s, x) => s + money(x.total), 0);
    head = "<tr><th>Nota</th><th>Kasir</th><th>Bayar</th><th>Total</th></tr>";
    body = sales
      .map((s) => `<tr><td>${esc(s.invoiceNo)}</td><td>${esc(s.user.username)}</td><td>${esc(s.paymentMethod)}</td><td>${rp(money(s.total))}</td></tr>`)
      .join("");
    body += `<tr><td colspan="3"><b>Total</b></td><td><b>${rp(total)}</b></td></tr>`;
  } else {
    title = "Laporan Hutang Supplier";
    const pos = await prisma.purchaseOrder.findMany({
      where: { status: "received" },
      include: { supplier: true },
      orderBy: { id: "desc" },
      take: 200,
    });
    head = "<tr><th>PO</th><th>Supplier</th><th>Total</th><th>Bayar</th><th>Sisa</th></tr>";
    body = pos
      .map((p) => {
        const sisa = money(p.totalAmount) - money(p.paidAmount);
        return `<tr><td>${esc(p.poNo)}</td><td>${esc(p.supplier.name)}</td><td>${rp(money(p.totalAmount))}</td><td>${rp(money(p.paidAmount))}</td><td>${rp(sisa)}</td></tr>`;
      })
      .join("");
  }

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>body{font-family:Arial,sans-serif;padding:24px;color:#0F3826}h1{font-size:18px}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #ccc;padding:6px 8px;font-size:12px;text-align:left}th{background:#0F3826;color:#fff}</style>
</head><body><h1>${esc(title)}</h1><p>WarungKu · ${new Date().toLocaleString("id-ID")}</p>
<table><thead>${head}</thead><tbody>${body}</tbody></table>
<script>window.onload=()=>window.print()</script></body></html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Access-Control-Allow-Origin": "*" },
  });
}

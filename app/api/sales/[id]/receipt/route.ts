import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { fail, money, options } from "@/lib/http";
import { NextResponse } from "next/server";

export const OPTIONS = options;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireUser(req, ["admin", "kasir"]);
  if (error) return error;
  const id = Number((await ctx.params).id);
  const s = await prisma.sale.findUnique({
    where: { id },
    include: {
      items: { include: { product: true } },
      user: { select: { username: true } },
    },
  });
  if (!s) return fail("Nota tidak ada", 404);

  const rows = s.items
    .map(
      (it) => `
    <tr>
      <td style="padding:4px 0">${it.product.name}<br><small style="color:#666">${it.qty} x ${money(it.unitPrice).toLocaleString("id-ID")}${it.discount ? ` (disc ${money(it.discount).toLocaleString("id-ID")})` : ""}</small></td>
      <td style="text-align:right;padding:4px 0;vertical-align:bottom">${(it.qty * money(it.unitPrice) - money(it.discount)).toLocaleString("id-ID")}</td>
    </tr>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Nota ${s.invoiceNo || "#" + s.id}</title>
<style>
  body { font-family: monospace; max-width: 320px; margin: 20px auto; padding: 10px; font-size: 13px; color: #111; line-height: 1.4; }
  h2 { margin: 0 0 5px 0; text-align: center; font-size: 18px; }
  .store-info { text-align: center; margin-bottom: 10px; font-size: 12px; color: #555; }
  .receipt-header { text-align: center; margin-bottom: 10px; border-bottom: 1px dashed #ccc; padding-bottom: 8px; }
  .receipt-body { margin: 10px 0; }
  .item { display: flex; justify-content: space-between; margin: 4px 0; font-size: 12px; }
  .item-name { flex: 1; }
  .item-price { text-align: right; width: 80px; }
  .total-section { margin: 15px 0; padding-top: 8px; border-top: 1px dashed #ccc; }
  .total-row { display: flex; justify-content: space-between; margin: 3px 0; font-size: 13px; }
  .total-label { font-weight: bold; }
  .total-amount { text-align: right; font-weight: bold; }
  .footer { text-align: center; margin-top: 15px; font-size: 12px; color: #666; border-top: 1px dashed #ccc; padding-top: 8px; }
  @media print { body { max-width: 100%; margin: 0; } }
</style>
</head>
<body onload="window.print()">
  <h2>WARUNGKU</h2>
  <div class="store-info">Sistem Kasir Toko Kelontong</div>
  <div class="receipt-header">
    <div>Nota: ${s.invoiceNo || "#" + s.id}</div>
    <div>Kasir: ${s.user.username}</div>
    <div>Waktu: ${new Date(s.saleDate).toLocaleString("id-ID")}</div>
  </div>
  <div class="receipt-body">
    ${rows}
  </div>
  <div class="total-section">
    ${s.discount ? `<div class="total-row"><span class="total-label">Diskon</span><span class="total-amount">-${money(s.discount).toLocaleString("id-ID")}</span></div>` : ""}
    <div class="total-row"><span class="total-label">TOTAL</span><span class="total-amount">Rp ${money(s.total).toLocaleString("id-ID")}</span></div>
    <div class="total-row"><span class="total-label">Bayar (${s.paymentMethod})</span><span class="total-amount">Rp ${money(s.cashPaid).toLocaleString("id-ID")}</span></div>
    <div class="total-row"><span class="total-label">Kembali</span><span class="total-amount">Rp ${money(s.changeGiven).toLocaleString("id-ID")}</span></div>
  </div>
  <div class="footer">Terima kasih atas kunjungan Anda</div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

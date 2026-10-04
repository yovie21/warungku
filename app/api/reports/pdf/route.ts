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
  let contentHtml = "";

  if (kind === "sales") {
    title = `Laporan Penjualan (${from} s/d ${to})`;
    const sales = await prisma.sale.findMany({
      where: { saleDate: { gte: new Date(from), lte: new Date(`${to}T23:59:59+07:00`) } },
      include: { user: { select: { username: true } } },
      orderBy: { id: "asc" },
      take: 1000,
    });

    const totalGross = sales.reduce((s, x) => s + money(x.total) + money(x.discount), 0);
    const totalDiscount = sales.reduce((s, x) => s + money(x.discount), 0);
    const totalNet = sales.reduce((s, x) => s + money(x.total), 0);
    const totalCount = sales.length;

    const paymentSummary: Record<string, number> = {};
    for (const s of sales) {
      const m = s.paymentMethod || "tunai";
      paymentSummary[m] = (paymentSummary[m] || 0) + money(s.total);
    }

    const rowsHtml = sales
      .map((s, idx) => {
        const dateStr = s.saleDate ? new Date(s.saleDate).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) : "-";
        return `<tr>
          <td style="text-align:center">${idx + 1}</td>
          <td><b>${esc(s.invoiceNo)}</b></td>
          <td>${esc(dateStr)}</td>
          <td>${esc(s.user.username)}</td>
          <td style="text-align:center">${esc(s.paymentMethod.toUpperCase())}</td>
          <td style="text-align:right">${rp(money(s.discount))}</td>
          <td style="text-align:right"><b>${rp(money(s.total))}</b></td>
        </tr>`;
      })
      .join("");

    const paySummaryHtml = Object.entries(paymentSummary)
      .map(([method, amount]) => `<li><b>${method.toUpperCase()}:</b> ${rp(amount)}</li>`)
      .join("");

    contentHtml = `
      <div class="kpi-container">
        <div class="kpi-box">
          <div class="kpi-label">Total Transaksi</div>
          <div class="kpi-val">${totalCount} Nota</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-label">Omzet Kotor</div>
          <div class="kpi-val">${rp(totalGross)}</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-label">Total Diskon</div>
          <div class="kpi-val">${rp(totalDiscount)}</div>
        </div>
        <div class="kpi-box highlight">
          <div class="kpi-label">Omzet Bersih (Net)</div>
          <div class="kpi-val">${rp(totalNet)}</div>
        </div>
      </div>

      <div style="margin-bottom: 16px; font-size: 13px;">
        <b>Rekapitulasi Pembayaran:</b>
        <ul style="margin: 4px 0; padding-left: 20px;">
          ${paySummaryHtml || "<li>Tunai: " + rp(totalNet) + "</li>"}
        </ul>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 40px; text-align:center">No</th>
            <th>No. Nota</th>
            <th>Tanggal & Jam</th>
            <th>Kasir</th>
            <th style="text-align:center">Metode</th>
            <th style="text-align:right">Diskon</th>
            <th style="text-align:right">Total Bayar</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || '<tr><td colspan="7" style="text-align:center; padding: 20px;">Tidak ada data penjualan pada periode ini</td></tr>'}
        </tbody>
        <tfoot>
          <tr class="grand-total">
            <td colspan="6" style="text-align:right">GRAND TOTAL PENDAPATAN BERSIH:</td>
            <td style="text-align:right">${rp(totalNet)}</td>
          </tr>
        </tfoot>
      </table>
    `;
  } else {
    title = "Laporan Hutang Supplier";
    const pos = await prisma.purchaseOrder.findMany({
      include: { supplier: true },
      orderBy: { id: "desc" },
      take: 500,
    });

    let totalPo = 0;
    let totalPaid = 0;
    let totalDebt = 0;

    const rowsHtml = pos
      .map((p, idx) => {
        const amount = money(p.totalAmount);
        const paid = money(p.paidAmount);
        const sisa = amount - paid;
        totalPo += amount;
        totalPaid += paid;
        totalDebt += sisa;

        return `<tr>
          <td style="text-align:center">${idx + 1}</td>
          <td><b>${esc(p.poNo || "PO#" + p.id)}</b></td>
          <td>${esc(p.supplier?.name || "Supplier")}</td>
          <td style="text-align:center"><span class="badge ${p.status}">${p.status.toUpperCase()}</span></td>
          <td style="text-align:right">${rp(amount)}</td>
          <td style="text-align:right">${rp(paid)}</td>
          <td style="text-align:right; color: ${sisa > 0 ? '#DC2626' : '#16A34A'}"><b>${rp(sisa)}</b></td>
        </tr>`;
      })
      .join("");

    contentHtml = `
      <div class="kpi-container">
        <div class="kpi-box">
          <div class="kpi-label">Total Pembelian (PO)</div>
          <div class="kpi-val">${rp(totalPo)}</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-label">Total Sudah Dibayar</div>
          <div class="kpi-val">${rp(totalPaid)}</div>
        </div>
        <div class="kpi-box highlight" style="border-color: #DC2626;">
          <div class="kpi-label" style="color: #DC2626;">Sisa Hutang Supplier</div>
          <div class="kpi-val" style="color: #DC2626;">${rp(totalDebt)}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 40px; text-align:center">No</th>
            <th>No. PO</th>
            <th>Supplier</th>
            <th style="text-align:center">Status</th>
            <th style="text-align:right">Total Tagihan</th>
            <th style="text-align:right">Dibayar</th>
            <th style="text-align:right">Sisa Hutang</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || '<tr><td colspan="7" style="text-align:center; padding: 20px;">Tidak ada data PO / Hutang</td></tr>'}
        </tbody>
        <tfoot>
          <tr class="grand-total">
            <td colspan="4" style="text-align:right">TOTAL KESELURUHAN:</td>
            <td style="text-align:right">${rp(totalPo)}</td>
            <td style="text-align:right">${rp(totalPaid)}</td>
            <td style="text-align:right; color: #DC2626;">${rp(totalDebt)}</td>
          </tr>
        </tfoot>
      </table>
    `;
  }

  const printDate = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<style>
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 30px; color: #1E293B; font-size: 13px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0F3826; padding-bottom: 16px; margin-bottom: 20px; }
  .store-title { font-size: 22px; font-weight: 900; color: #0F3826; letter-spacing: -0.5px; }
  .store-sub { font-size: 12px; color: #64748B; margin-top: 4px; }
  .report-meta { text-align: right; }
  .report-title { font-size: 16px; font-weight: 800; color: #0F3826; }
  .report-date { font-size: 11px; color: #64748B; margin-top: 4px; }
  
  .kpi-container { display: flex; gap: 12px; margin-bottom: 20px; }
  .kpi-box { flex: 1; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px; text-align: center; }
  .kpi-box.highlight { background: #F0FDF4; border-color: #10B981; }
  .kpi-label { font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; }
  .kpi-val { font-size: 15px; font-weight: 800; color: #0F3826; margin-top: 6px; }

  table { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 30px; }
  th, td { border: 1px solid #CBD5E1; padding: 8px 10px; font-size: 12px; text-align: left; }
  th { background: #0F3826; color: #FFFFFF; font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; }
  tr:nth-child(even) { background-color: #F8FAFC; }
  .grand-total { background: #ECFDF5 !important; font-weight: 800; font-size: 13px; color: #065F46; }

  .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; }
  .badge.received { background: #DCFCE7; color: #166534; }
  .badge.ordered { background: #FEF3C7; color: #92400E; }
  .badge.draft { background: #F1F5F9; color: #475569; }

  .signature-section { display: flex; justify-content: space-between; margin-top: 40px; page-break-inside: avoid; }
  .sig-box { width: 200px; text-align: center; font-size: 12px; }
  .sig-line { margin-top: 60px; border-bottom: 1px solid #0F3826; }

  @media print {
    body { padding: 10px; }
    .kpi-container { gap: 8px; }
  }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="store-title">WARUNGKU / CAHAYA HERBAL</div>
      <div class="store-sub">Sistem Konsinyasi & POS Toko Kelontong</div>
    </div>
    <div class="report-meta">
      <div class="report-title">${esc(title)}</div>
      <div class="report-date">Dicetak pada: ${printDate}</div>
    </div>
  </div>

  ${contentHtml}

  <div class="signature-section">
    <div class="sig-box">
      <div>Dibuat Oleh,</div>
      <div class="sig-line"></div>
      <div style="margin-top: 4px; font-weight: bold;">Kasir / Admin</div>
    </div>
    <div class="sig-box">
      <div>Mengetahui,</div>
      <div class="sig-line"></div>
      <div style="margin-top: 4px; font-weight: bold;">Pemilik Toko</div>
    </div>
  </div>

  <script>
    window.onload = () => {
      setTimeout(() => {
        window.print();
      }, 300);
    };
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Access-Control-Allow-Origin": "*" },
  });
}

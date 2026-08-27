import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { computeTotals, SalesDocData } from "./generateSalesDoc";

export interface SalesReportDoc extends SalesDocData {
  id?: string;
  created_at?: string;
}

const PRIMARY: [number, number, number] = [0, 51, 102];
const PALETTE: [number, number, number][] = [
  [0, 51, 102],
  [212, 168, 30],
  [0, 140, 100],
  [190, 60, 60],
  [90, 80, 170],
  [40, 130, 190],
];

const monthKey = (d: string) => (d || "").slice(0, 7);

export const generateSalesReport = async (
  docs: SalesReportDoc[],
  opts: { from?: string; to?: string } = {}
) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const margin = 16;
  const money = (n: number) => `$${Number(n || 0).toFixed(2)}`;

  const withTotals = docs.map((d) => ({ ...d, t: computeTotals(d as any) }));
  const invoices = withTotals.filter((d) => d.doc_type === "invoice");
  const quotes = withTotals.filter((d) => d.doc_type === "quotation");
  const receipts = withTotals.filter((d) => d.doc_type === "receipt");

  const invoiced = invoices.reduce((s, d) => s + d.t.total, 0);
  const collected =
    receipts.reduce((s, d) => s + d.t.paid, 0) +
    invoices.reduce((s, d) => s + d.t.paid, 0);
  const outstanding = invoices.reduce((s, d) => s + Math.max(0, d.t.balance), 0);
  const quoted = quotes.reduce((s, d) => s + d.t.total, 0);
  const convRate = quotes.length
    ? (quotes.filter((q) => (q.status || "") === "accepted").length / quotes.length) * 100
    : 0;

  let y = margin;

  // ---------- Cover header ----------
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, pw, 34, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("DATAPLEX SALES REPORT", margin, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(215, 228, 245);
  const range =
    opts.from || opts.to
      ? `Period: ${opts.from || "start"} → ${opts.to || "today"}`
      : "Period: All time";
  doc.text(range, margin, 23);
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 29);
  y = 44;

  // ---------- Stat cards ----------
  const cards: [string, string][] = [
    ["Documents", String(withTotals.length)],
    ["Invoiced", money(invoiced)],
    ["Collected", money(collected)],
    ["Outstanding", money(outstanding)],
    ["Quoted", money(quoted)],
    ["Quote Conversion", `${convRate.toFixed(0)}%`],
  ];
  const cw = (pw - margin * 2 - 10) / 3;
  cards.forEach((c, i) => {
    const cx = margin + (i % 3) * (cw + 5);
    const cy = y + Math.floor(i / 3) * 24;
    doc.setFillColor(244, 247, 251);
    doc.setDrawColor(220, 228, 238);
    doc.roundedRect(cx, cy, cw, 20, 2, 2, "FD");
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.setFont("helvetica", "normal");
    doc.text(c[0].toUpperCase(), cx + 4, cy + 7);
    doc.setFontSize(13);
    doc.setTextColor(...PRIMARY);
    doc.setFont("helvetica", "bold");
    doc.text(c[1], cx + 4, cy + 15.5);
  });
  y += 24 * Math.ceil(cards.length / 3) + 6;

  // ---------- Monthly revenue bar chart ----------
  const months = Array.from(
    new Set(withTotals.map((d) => monthKey(d.issue_date || d.created_at || "")).filter(Boolean))
  ).sort();
  const monthly = months.map((m) => ({
    label: m,
    invoiced: withTotals
      .filter((d) => d.doc_type === "invoice" && monthKey(d.issue_date || "") === m)
      .reduce((s, d) => s + d.t.total, 0),
    collected: withTotals
      .filter((d) => monthKey(d.issue_date || "") === m)
      .reduce((s, d) => s + d.t.paid, 0),
  }));

  const drawAxis = (x: number, cy: number, w: number, h: number, title: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...PRIMARY);
    doc.text(title, x, cy - 3);
    doc.setDrawColor(200);
    doc.setLineWidth(0.2);
    doc.line(x, cy + h, x + w, cy + h);
    doc.line(x, cy, x, cy + h);
  };

  const chartW = pw - margin * 2;
  const chartH = 48;
  drawAxis(margin, y + 6, chartW, chartH, "Monthly Invoiced vs Collected");
  const cyTop = y + 6;
  const maxVal = Math.max(1, ...monthly.map((m) => Math.max(m.invoiced, m.collected)));
  const slot = monthly.length ? chartW / monthly.length : chartW;
  monthly.forEach((m, i) => {
    const bx = margin + i * slot + slot * 0.15;
    const bw = (slot * 0.7) / 2 - 1;
    const h1 = (m.invoiced / maxVal) * (chartH - 4);
    const h2 = (m.collected / maxVal) * (chartH - 4);
    doc.setFillColor(...PALETTE[0]);
    doc.rect(bx, cyTop + chartH - h1, bw, h1, "F");
    doc.setFillColor(...PALETTE[2]);
    doc.rect(bx + bw + 2, cyTop + chartH - h2, bw, h2, "F");
    doc.setFontSize(6.5);
    doc.setTextColor(90);
    doc.setFont("helvetica", "normal");
    doc.text(m.label.slice(2), bx, cyTop + chartH + 4);
  });
  // legend
  doc.setFillColor(...PALETTE[0]);
  doc.rect(pw - margin - 46, cyTop - 6, 3, 3, "F");
  doc.setFillColor(...PALETTE[2]);
  doc.rect(pw - margin - 22, cyTop - 6, 3, 3, "F");
  doc.setFontSize(7.5);
  doc.setTextColor(80);
  doc.text("Invoiced", pw - margin - 41, cyTop - 3.4);
  doc.text("Collected", pw - margin - 17, cyTop - 3.4);
  y = cyTop + chartH + 12;

  // ---------- Document mix + status charts ----------
  const mix: [string, number][] = [
    ["Quotations", quotes.length],
    ["Invoices", invoices.length],
    ["Receipts", receipts.length],
  ];
  const halfW = (chartW - 8) / 2;
  const barH = 40;
  drawAxis(margin, y + 6, halfW, barH, "Document Mix");
  const mixMax = Math.max(1, ...mix.map((m) => m[1]));
  mix.forEach((m, i) => {
    const s = halfW / mix.length;
    const bx = margin + i * s + s * 0.25;
    const bw = s * 0.5;
    const h = (m[1] / mixMax) * (barH - 4);
    doc.setFillColor(...PALETTE[i % PALETTE.length]);
    doc.rect(bx, y + 6 + barH - h, bw, h, "F");
    doc.setFontSize(7);
    doc.setTextColor(90);
    doc.text(String(m[1]), bx, y + 6 + barH - h - 1.5);
    doc.text(m[0], bx, y + 6 + barH + 4);
  });

  const statuses = Array.from(new Set(withTotals.map((d) => d.status || "draft")));
  const statusCounts = statuses.map((s) => ({
    label: s,
    n: withTotals.filter((d) => (d.status || "draft") === s).length,
  }));
  const x2 = margin + halfW + 8;
  drawAxis(x2, y + 6, halfW, barH, "Status Breakdown");
  const stMax = Math.max(1, ...statusCounts.map((s) => s.n));
  statusCounts.forEach((s, i) => {
    const sl = halfW / Math.max(1, statusCounts.length);
    const bx = x2 + i * sl + sl * 0.25;
    const bw = sl * 0.5;
    const h = (s.n / stMax) * (barH - 4);
    doc.setFillColor(...PALETTE[(i + 1) % PALETTE.length]);
    doc.rect(bx, y + 6 + barH - h, bw, h, "F");
    doc.setFontSize(7);
    doc.setTextColor(90);
    doc.text(String(s.n), bx, y + 6 + barH - h - 1.5);
    doc.text(s.label, bx, y + 6 + barH + 4);
  });
  y += barH + 18;

  // ---------- Top clients ----------
  const byClient: Record<string, number> = {};
  invoices.forEach((d) => {
    byClient[d.client_name || "—"] = (byClient[d.client_name || "—"] || 0) + d.t.total;
  });
  const top = Object.entries(byClient).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (top.length) {
    if (y + top.length * 8 + 20 > ph - 20) {
      doc.addPage();
      y = margin;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...PRIMARY);
    doc.text("Top Clients by Invoiced Value", margin, y);
    y += 6;
    const maxC = Math.max(...top.map((t) => t[1]), 1);
    top.forEach(([name, val], i) => {
      const bw = ((pw - margin * 2 - 70) * val) / maxC;
      doc.setFontSize(8);
      doc.setTextColor(60);
      doc.setFont("helvetica", "normal");
      doc.text(String(name).slice(0, 26), margin, y + 3.5);
      doc.setFillColor(...PALETTE[i % PALETTE.length]);
      doc.rect(margin + 46, y, Math.max(1, bw), 5, "F");
      doc.text(money(val), pw - margin, y + 3.5, { align: "right" });
      y += 8;
    });
    y += 6;
  }

  // ---------- Detail table ----------
  doc.addPage();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...PRIMARY);
  doc.text("Document Register", margin, margin + 2);
  autoTable(doc, {
    startY: margin + 6,
    head: [["Date", "Number", "Type", "Client", "Status", "Total", "Paid", "Balance"]],
    body: withTotals
      .slice()
      .sort((a, b) => (b.issue_date || "").localeCompare(a.issue_date || ""))
      .map((d) => [
        d.issue_date || "",
        d.doc_number,
        d.doc_type,
        d.client_name,
        d.status || "draft",
        money(d.t.total),
        money(d.t.paid),
        money(d.t.balance),
      ]),
    foot: [[
      "", "", "", "", "TOTALS",
      money(withTotals.reduce((s, d) => s + d.t.total, 0)),
      money(withTotals.reduce((s, d) => s + d.t.paid, 0)),
      money(withTotals.reduce((s, d) => s + d.t.balance, 0)),
    ]],
    theme: "grid",
    headStyles: { fillColor: PRIMARY, textColor: 255, fontSize: 8.5 },
    footStyles: { fillColor: [235, 240, 248], textColor: 20, fontStyle: "bold", fontSize: 8.5 },
    styles: { fontSize: 8, cellPadding: 2 },
    margin: { left: margin, right: margin },
  });

  // ---------- Footer ----------
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text("Dataplex Softwares — Confidential Sales Report", margin, ph - 8);
    doc.text(`Page ${i} of ${total}`, pw - margin, ph - 8, { align: "right" });
  }

  doc.save(`Dataplex_Sales_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
};

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { DEFAULT_PROVIDER } from "./slaDefaults";
import { loadStampDataUrl } from "./generateSLA";

export interface SalesLineItem {
  description: string;
  qty: number;
  unit_price: number;
}

export interface SalesDocData {
  doc_type: "quotation" | "invoice" | "receipt";
  doc_number: string;
  client_name: string;
  contact_person?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  issue_date?: string | null;
  due_date?: string | null;
  valid_until?: string | null;
  status?: string | null;
  currency: string;
  items: SalesLineItem[];
  tax_percent: number;
  discount: number;
  amount_paid: number;
  payment_method?: string | null;
  notes?: string | null;
  provider?: Record<string, any> | null;
}

export const computeTotals = (d: {
  items: SalesLineItem[];
  tax_percent: number;
  discount: number;
  amount_paid: number;
}) => {
  const subtotal = (d.items || []).reduce(
    (s, it) => s + Number(it.qty || 0) * Number(it.unit_price || 0),
    0
  );
  const discount = Number(d.discount || 0);
  const taxable = Math.max(0, subtotal - discount);
  const tax = (taxable * Number(d.tax_percent || 0)) / 100;
  const total = taxable + tax;
  const paid = Number(d.amount_paid || 0);
  return { subtotal, discount, tax, total, paid, balance: total - paid };
};

const TITLES: Record<string, string> = {
  quotation: "QUOTATION",
  invoice: "TAX INVOICE",
  receipt: "RECEIPT",
};

export const generateSalesDoc = async (data: SalesDocData) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const margin = 16;
  const primary: [number, number, number] = [0, 51, 102];
  const gold: [number, number, number] = [190, 150, 20];
  const panel: [number, number, number] = [242, 245, 249];

  const provider = { ...DEFAULT_PROVIDER, ...(data.provider || {}) };
  const t = computeTotals(data);
  const cur = data.currency || "USD";
  const money = (n: number) => `${cur} $${Number(n).toFixed(2)}`;

  // ---------- Masthead ----------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...primary);
  doc.text("DATAPLEX SOFTWARES", margin, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("Relax we make it easy", margin, 25.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.setTextColor(40);
  doc.text(TITLES[data.doc_type] || "DOCUMENT", pw - margin, 19, { align: "right" });

  doc.setFontSize(8.5);
  const metaRows: [string, string][] = [
    ["Date:", data.issue_date || new Date().toISOString().slice(0, 10)],
    ["Doc #:", data.doc_number],
    ...(data.doc_type === "invoice" && data.due_date
      ? ([["Due:", data.due_date]] as [string, string][])
      : []),
    ...(data.doc_type === "quotation" && data.valid_until
      ? ([["Valid until:", data.valid_until]] as [string, string][])
      : []),
  ];
  let my = 25;
  metaRows.forEach(([k, v]) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60);
    doc.text(k, pw - margin - 34, my, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40);
    doc.text(String(v), pw - margin, my, { align: "right" });
    my += 4.6;
  });

  // ---------- Parties panel ----------
  let y = Math.max(my + 4, 40);
  const left = [
    provider.name,
    provider.business_type,
    provider.address,
    provider.phone,
    provider.email,
  ].filter(Boolean) as string[];
  const right = [
    data.client_name,
    data.contact_person ? `Attn: ${data.contact_person}` : "",
    data.address || "",
    data.phone || "",
    data.email || "",
  ].filter(Boolean) as string[];

  const panelH = 12 + Math.max(left.length, right.length) * 4.6;
  doc.setFillColor(...panel);
  doc.rect(margin, y, pw - margin * 2, panelH, "F");
  doc.setFillColor(...primary);
  doc.rect(margin, y, 1.6, panelH, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...primary);
  doc.text("FROM", margin + 6, y + 6);
  doc.text("BILL TO", pw / 2 + 2, y + 6);

  doc.setFontSize(9);
  let py = y + 11.5;
  const rowsN = Math.max(left.length, right.length);
  for (let i = 0; i < rowsN; i++) {
    doc.setFont("helvetica", i === 0 ? "bold" : "normal");
    doc.setTextColor(i === 0 ? 25 : 70);
    if (left[i]) doc.text(String(left[i]), margin + 6, py);
    if (right[i]) doc.text(String(right[i]), pw / 2 + 2, py);
    py += 4.6;
  }
  y += panelH + 8;

  // ---------- Items ----------
  autoTable(doc, {
    startY: y,
    head: [["#", "Description", "Qty", "Unit Price", "Amount"]],
    body: (data.items || []).map((it, i) => [
      String(i + 1),
      it.description || "",
      String(it.qty ?? 0),
      money(Number(it.unit_price || 0)),
      money(Number(it.qty || 0) * Number(it.unit_price || 0)),
    ]),
    theme: "plain",
    headStyles: {
      fillColor: primary,
      textColor: 255,
      fontSize: 8.5,
      fontStyle: "bold",
      cellPadding: 2.6,
    },
    bodyStyles: { fontSize: 9, cellPadding: 2.8, textColor: 45 },
    alternateRowStyles: { fillColor: [249, 250, 252] },
    columnStyles: {
      0: { cellWidth: 10 },
      2: { cellWidth: 16, halign: "right" },
      3: { cellWidth: 30, halign: "right" },
      4: { cellWidth: 32, halign: "right" },
    },
    margin: { left: margin, right: margin },
    didDrawPage: () => {},
  });
  y = (doc as any).lastAutoTable.finalY + 2;
  doc.setDrawColor(215);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pw - margin, y);
  y += 8;

  // ---------- Totals block ----------
  const boxW = 78;
  const boxX = pw - margin - boxW;
  const lines: [string, string][] = [
    ["Subtotal", money(t.subtotal)],
    ...(t.discount ? ([["Discount", `- ${money(t.discount)}`]] as [string, string][]) : []),
    ...(data.tax_percent
      ? ([[`Tax (${Number(data.tax_percent).toFixed(1)}%)`, money(t.tax)]] as [string, string][])
      : []),
    ["TOTAL", money(t.total)],
    ...(data.doc_type !== "quotation"
      ? ([
          ["Amount Paid", money(t.paid)],
          ["Balance Due", money(t.balance)],
        ] as [string, string][])
      : []),
  ];

  if (y + lines.length * 6 + 10 > ph - 50) {
    doc.addPage();
    y = margin;
  }

  lines.forEach(([label, val]) => {
    const isTotal = label === "TOTAL";
    if (isTotal) {
      doc.setFillColor(...primary);
      doc.rect(boxX, y - 4.8, boxW, 8, "F");
      doc.setTextColor(255);
      doc.setFont("helvetica", "bold");
    } else {
      doc.setTextColor(60);
      doc.setFont("helvetica", "normal");
    }
    doc.setFontSize(9.5);
    doc.text(label, boxX + 3, y);
    doc.text(val, boxX + boxW - 3, y, { align: "right" });
    y += isTotal ? 9.5 : 6;
  });

  doc.setTextColor(40);
  y += 2;

  // ---------- Paid badge ----------
  if (data.doc_type === "receipt") {
    const badgeY = y;
    doc.setFillColor(232, 246, 237);
    doc.setDrawColor(0, 140, 75);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, badgeY - 6, 88, 16, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(0, 120, 60);
    doc.text("PAID IN FULL", margin + 5, badgeY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(45, 90, 65);
    doc.text(
      `${money(t.paid)}${data.payment_method ? `  •  ${data.payment_method}` : ""}`,
      margin + 5,
      badgeY + 6
    );
    doc.setTextColor(40);
    y = badgeY + 16;
  }

  if (data.notes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...primary);
    doc.text("NOTES", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(70);
    doc.splitTextToSize(data.notes, pw - margin * 2 - 82).forEach((ln: string) => {
      doc.text(ln, margin, y);
      y += 4.6;
    });
    y += 4;
  }



  // Signature + stamp
  const sigY = Math.min(Math.max(y + 6, ph - 62), ph - 50);
  doc.setDrawColor(150);
  doc.setLineWidth(0.2);
  doc.line(margin, sigY + 14, margin + 60, sigY + 14);
  doc.setFontSize(9);
  doc.setTextColor(60);
  doc.text("Authorised Signature", margin, sigY + 19);
  doc.text(provider.name || "", margin, sigY + 24);

  const stamp = await loadStampDataUrl();
  if (stamp) {
    const sw = 44;
    const sh = 44 * (1240 / 1256);
    doc.saveGraphicsState();
    // @ts-ignore
    doc.setGState(new (doc as any).GState({ opacity: 0.82 }));
    doc.addImage(stamp, "PNG", margin + 22, sigY - 12, sw, sh, `stamp-${data.doc_number}`, "NONE", -11);
    doc.restoreGraphicsState();
  }

  // Footer on every page
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...primary);
    doc.setLineWidth(0.4);
    doc.line(margin, ph - 14, pw - margin, ph - 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Dataplex Softwares  •  ${data.doc_number}`, margin, ph - 9);
    doc.text(`Page ${i} of ${total}`, pw - margin, ph - 9, { align: "right" });
  }

  doc.save(`${TITLES[data.doc_type].replace(/\s+/g, "_")}_${data.doc_number}.pdf`);
};

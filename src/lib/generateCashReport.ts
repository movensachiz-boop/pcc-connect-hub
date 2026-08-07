import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface CashTxn {
  time: string;
  reference: string;
  description: string;
  method: string;
  amount: number;
  source: "Fees" | "Vacation" | "Shop";
}

export interface CashOutflow {
  time: string;
  type: string;
  recipient: string;
  reason: string;
  reference: string;
  amount: number;
}

export interface CashReportData {
  cashierName: string;
  businessDate: string;
  openedAt?: string;
  closedAt?: string;
  openingFloat: number;
  closingCounted?: number | null;
  currency?: string;
  receipts: CashTxn[];
  outflows: CashOutflow[];
  notes?: string;
}

const PRIMARY: [number, number, number] = [0, 51, 102];
const BLUE: [number, number, number] = [41, 128, 185];

export const generateCashReport = async (d: CashReportData) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = 210;
  const ph = 297;
  const margin = 14;
  const cur = d.currency || "USD";
  const money = (n: number) => `${cur} ${Number(n || 0).toFixed(2)}`;
  let y = 12;

  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.6);
  doc.rect(8, 8, pw - 16, ph - 16);

  try {
    const logoModule = await import("@/assets/pcc-logo.png");
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject();
      img.src = logoModule.default;
    });
    doc.addImage(img, "PNG", margin, y, 20, 20);
  } catch {}

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...PRIMARY);
  doc.text("PROGRESS CHRISTIAN CENTRE", margin + 24, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  doc.text("11729 Mkoba 14, Gweru, Zimbabwe", margin + 24, y + 11);
  doc.text("Tel: +263 77 400 0143  |  www.progresscentresys.com", margin + 24, y + 15);
  y += 24;

  doc.setFillColor(...BLUE);
  doc.rect(margin, y, pw - 2 * margin, 9, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(255, 255, 255);
  doc.text("DAILY CASH & ACCOUNTING REPORT", pw / 2, y + 6, { align: "center" });
  y += 13;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    body: [
      ["Cashier", d.cashierName, "Business Date", d.businessDate],
      ["Day Opened", d.openedAt || "—", "Day Closed", d.closedAt || "Still open"],
    ],
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2.4, lineColor: [210, 210, 210], textColor: [30, 30, 30] },
    columnStyles: {
      0: { fontStyle: "bold", fillColor: [240, 245, 250], cellWidth: 30 },
      2: { fontStyle: "bold", fillColor: [240, 245, 250], cellWidth: 30 },
    },
  });
  // @ts-ignore
  y = doc.lastAutoTable.finalY + 6;

  // Receipts
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...PRIMARY);
  doc.text("A. MONEY RECEIVED", margin, y);
  y += 3;

  const totalIn = d.receipts.reduce((s, r) => s + Number(r.amount || 0), 0);
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Time", "Receipt / Ref", "Description", "Source", "Method", "Amount"]],
    body: d.receipts.length
      ? d.receipts.map((r) => [r.time, r.reference, r.description, r.source, r.method, money(r.amount)])
      : [[{ content: "No receipts recorded for this day", colSpan: 6, styles: { halign: "center" as const, textColor: [130, 130, 130] } }]],
    foot: [[{ content: "TOTAL RECEIVED", colSpan: 5, styles: { halign: "right" as const, fontStyle: "bold" as const } }, { content: money(totalIn), styles: { fontStyle: "bold" as const } }]],
    theme: "grid",
    headStyles: { fillColor: [...PRIMARY], textColor: [255, 255, 255], fontSize: 8.5 },
    bodyStyles: { fontSize: 8, cellPadding: 2 },
    footStyles: { fillColor: [240, 245, 250], textColor: [...PRIMARY], fontSize: 9.5 },
    columnStyles: { 0: { cellWidth: 16 }, 3: { cellWidth: 18 }, 4: { cellWidth: 22 }, 5: { halign: "right", cellWidth: 28 } },
  });
  // @ts-ignore
  y = doc.lastAutoTable.finalY + 7;

  // Outflows
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...PRIMARY);
  doc.text("B. MONEY DISBURSED / TRANSFERRED", margin, y);
  y += 3;

  const totalOut = d.outflows.reduce((s, r) => s + Number(r.amount || 0), 0);
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Time", "Type", "Paid To / Bank", "Reason", "Reference", "Amount"]],
    body: d.outflows.length
      ? d.outflows.map((r) => [r.time, r.type, r.recipient, r.reason, r.reference, money(r.amount)])
      : [[{ content: "No disbursements recorded for this day", colSpan: 6, styles: { halign: "center" as const, textColor: [130, 130, 130] } }]],
    foot: [[{ content: "TOTAL DISBURSED", colSpan: 5, styles: { halign: "right" as const, fontStyle: "bold" as const } }, { content: money(totalOut), styles: { fontStyle: "bold" as const } }]],
    theme: "grid",
    headStyles: { fillColor: [...PRIMARY], textColor: [255, 255, 255], fontSize: 8.5 },
    bodyStyles: { fontSize: 8, cellPadding: 2 },
    footStyles: { fillColor: [240, 245, 250], textColor: [...PRIMARY], fontSize: 9.5 },
    columnStyles: { 0: { cellWidth: 16 }, 1: { cellWidth: 30 }, 5: { halign: "right", cellWidth: 28 } },
  });
  // @ts-ignore
  y = doc.lastAutoTable.finalY + 7;

  // Reconciliation
  const expected = Number(d.openingFloat || 0) + totalIn - totalOut;
  const counted = d.closingCounted == null ? null : Number(d.closingCounted);
  const variance = counted == null ? null : counted - expected;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["RECONCILIATION", "Amount"]],
    body: [
      ["Opening float", money(d.openingFloat)],
      ["Add: total received", money(totalIn)],
      ["Less: total disbursed / banked", `(${money(totalOut)})`],
      ["Expected closing balance", money(expected)],
      ["Actual cash counted at close", counted == null ? "—" : money(counted)],
      ["Variance (over / short)", variance == null ? "—" : money(variance)],
    ],
    theme: "grid",
    headStyles: { fillColor: [...PRIMARY], textColor: [255, 255, 255], fontSize: 9 },
    bodyStyles: { fontSize: 9, cellPadding: 2.4 },
    columnStyles: { 0: { cellWidth: pw - 2 * margin - 45 }, 1: { halign: "right", cellWidth: 45, fontStyle: "bold" } },
  });
  // @ts-ignore
  y = doc.lastAutoTable.finalY + 6;

  if (d.notes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...PRIMARY);
    doc.text("Notes:", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    const lines = doc.splitTextToSize(d.notes, pw - 2 * margin);
    doc.text(lines, margin, y + 4.5);
    y += 5 + lines.length * 4;
  }

  // Signatures
  y = Math.max(y + 12, ph - 48);
  const colW = (pw - 2 * margin) / 3;
  ["Cashier (cash counted)", "Received By (transfers/cash)", "Verified By (Accounts)"].forEach((label, i) => {
    const x = margin + i * colW + 4;
    doc.setDrawColor(120, 120, 120);
    doc.line(x, y, x + colW - 8, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(80, 80, 80);
    doc.text(label, x, y + 4);
    doc.text("Name, Signature & Date", x, y + 8);
  });

  doc.setFontSize(7.5);
  doc.setTextColor(120, 120, 120);
  doc.text(`Generated ${new Date().toLocaleString()} • Progress Christian Centre Accounts`, pw / 2, ph - 10, { align: "center" });

  doc.save(`Cash_Report_${d.cashierName.replace(/\s+/g, "_")}_${d.businessDate}.pdf`);
};

export interface PeriodRow {
  date: string;
  cashier: string;
  received: number;
  disbursed: number;
  net: number;
}

export const generatePeriodCashReport = async (
  rows: PeriodRow[],
  fromDate: string,
  toDate: string,
  currency = "USD"
) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = 210;
  const ph = 297;
  const margin = 14;
  const money = (n: number) => `${currency} ${Number(n || 0).toFixed(2)}`;
  let y = 14;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...PRIMARY);
  doc.text("PROGRESS CHRISTIAN CENTRE", pw / 2, y, { align: "center" });
  doc.setFontSize(11);
  doc.text("CASH COLLECTION SUMMARY", pw / 2, y + 7, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Period: ${fromDate} to ${toDate}`, pw / 2, y + 13, { align: "center" });
  y += 20;

  const tIn = rows.reduce((s, r) => s + r.received, 0);
  const tOut = rows.reduce((s, r) => s + r.disbursed, 0);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Date", "Cashier", "Received", "Disbursed", "Net"]],
    body: rows.map((r) => [r.date, r.cashier, money(r.received), money(r.disbursed), money(r.net)]),
    foot: [[
      { content: "OVERALL", colSpan: 2, styles: { fontStyle: "bold" as const } },
      { content: money(tIn), styles: { fontStyle: "bold" as const, halign: "right" as const } },
      { content: money(tOut), styles: { fontStyle: "bold" as const, halign: "right" as const } },
      { content: money(tIn - tOut), styles: { fontStyle: "bold" as const, halign: "right" as const } },
    ]],
    theme: "grid",
    headStyles: { fillColor: [...PRIMARY], textColor: [255, 255, 255], fontSize: 9 },
    bodyStyles: { fontSize: 8.5, cellPadding: 2 },
    footStyles: { fillColor: [240, 245, 250], textColor: [...PRIMARY], fontSize: 9.5 },
    columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
  });

  // @ts-ignore
  y = doc.lastAutoTable.finalY + 20;
  const colW = (pw - 2 * margin) / 2;
  ["Prepared By (Cashier / Accounts)", "Approved By (Administrator)"].forEach((label, i) => {
    const x = margin + i * colW + 6;
    doc.setDrawColor(120, 120, 120);
    doc.line(x, y, x + colW - 12, y);
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(label, x, y + 4);
    doc.text("Name, Signature & Date", x, y + 8);
  });

  doc.setFontSize(7.5);
  doc.setTextColor(120, 120, 120);
  doc.text(`Generated ${new Date().toLocaleString()}`, pw / 2, ph - 10, { align: "center" });

  doc.save(`Cash_Summary_${fromDate}_to_${toDate}.pdf`);
};

export interface InventoryReportRow {
  name: string;
  category: string;
  price: number;
  stock: number;
  soldQty: number;
  soldValue: number;
}

export const generateInventoryReport = async (
  rows: InventoryReportRow[],
  periodLabel: string,
  totals: { salesThisPeriod: number; priorTermSettled: number; stockValue: number },
  currency = "USD"
) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = 210;
  const ph = 297;
  const margin = 14;
  const money = (n: number) => `${currency} ${Number(n || 0).toFixed(2)}`;
  let y = 14;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...PRIMARY);
  doc.text("PROGRESS CHRISTIAN CENTRE", pw / 2, y, { align: "center" });
  doc.setFontSize(11);
  doc.text("INVENTORY & SHOP SALES REPORT", pw / 2, y + 7, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(periodLabel, pw / 2, y + 13, { align: "center" });
  y += 20;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    body: [
      ["Sales recorded in period", money(totals.salesThisPeriod)],
      ["Prior-term balances settled in period", money(totals.priorTermSettled)],
      ["Current stock value on hand", money(totals.stockValue)],
    ],
    theme: "grid",
    styles: { fontSize: 9.5, cellPadding: 2.6 },
    columnStyles: { 0: { fontStyle: "bold", fillColor: [240, 245, 250] }, 1: { halign: "right", fontStyle: "bold" } },
  });
  // @ts-ignore
  y = doc.lastAutoTable.finalY + 7;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Item", "Category", "Unit Price", "In Stock", "Qty Sold", "Sales Value"]],
    body: rows.map((r) => [r.name, r.category, money(r.price), String(r.stock), String(r.soldQty), money(r.soldValue)]),
    foot: [[
      { content: "TOTAL", colSpan: 5, styles: { halign: "right" as const, fontStyle: "bold" as const } },
      { content: money(rows.reduce((s, r) => s + r.soldValue, 0)), styles: { fontStyle: "bold" as const, halign: "right" as const } },
    ]],
    theme: "grid",
    headStyles: { fillColor: [...PRIMARY], textColor: [255, 255, 255], fontSize: 9 },
    bodyStyles: { fontSize: 8.5, cellPadding: 2 },
    footStyles: { fillColor: [240, 245, 250], textColor: [...PRIMARY], fontSize: 9.5 },
    columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
  });

  // @ts-ignore
  y = doc.lastAutoTable.finalY + 20;
  const colW = (pw - 2 * margin) / 2;
  ["Prepared By (Storekeeper / Cashier)", "Approved By (Administrator)"].forEach((label, i) => {
    const x = margin + i * colW + 6;
    doc.setDrawColor(120, 120, 120);
    doc.line(x, y, x + colW - 12, y);
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(label, x, y + 4);
    doc.text("Name, Signature & Date", x, y + 8);
  });

  doc.setFontSize(7.5);
  doc.setTextColor(120, 120, 120);
  doc.text(`Generated ${new Date().toLocaleString()}`, pw / 2, ph - 10, { align: "center" });

  doc.save(`Inventory_Report_${periodLabel.replace(/[^\w]+/g, "_")}.pdf`);
};

export interface MovementVoucherData {
  voucherNo: string;
  kind: "in" | "out";
  typeLabel: string;
  amount: number;
  currency?: string;
  dateTime: string;
  issuedBy: string;
  receivedBy: string;
  reason?: string | null;
  reference?: string | null;
  businessDate: string;
}

const amountInWords = (n: number) => {
  const ones = ["zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
  const tens = ["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];
  const conv = (num: number): string => {
    if (num < 20) return ones[num];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? `-${ones[num % 10]}` : "");
    if (num < 1000) return `${ones[Math.floor(num / 100)]} hundred${num % 100 ? ` and ${conv(num % 100)}` : ""}`;
    if (num < 1000000) return `${conv(Math.floor(num / 1000))} thousand${num % 1000 ? ` ${conv(num % 1000)}` : ""}`;
    return `${conv(Math.floor(num / 1000000))} million${num % 1000000 ? ` ${conv(num % 1000000)}` : ""}`;
  };
  const whole = Math.floor(Math.abs(n));
  const cents = Math.round((Math.abs(n) - whole) * 100);
  const s = `${conv(whole)}${cents ? ` and ${cents}/100` : ""} only`;
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const generateMovementVoucher = async (d: MovementVoucherData) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = 210;
  const margin = 16;
  const cur = d.currency || "USD";
  const money = (n: number) => `${cur} ${Number(n || 0).toFixed(2)}`;
  let y = 14;

  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.6);
  doc.rect(8, 8, pw - 16, 160);

  try {
    const logoModule = await import("@/assets/pcc-logo.png");
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject();
      img.src = logoModule.default;
    });
    doc.addImage(img, "PNG", margin, y, 20, 20);
  } catch {}

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...PRIMARY);
  doc.text("PROGRESS CHRISTIAN CENTRE", margin + 24, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  doc.text("11729 Mkoba 14, Gweru, Zimbabwe", margin + 24, y + 11);
  doc.text("Tel: +263 77 400 0143  |  www.progresscentresys.com", margin + 24, y + 15);
  y += 24;

  doc.setFillColor(...BLUE);
  doc.rect(margin, y, pw - 2 * margin, 9, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(255, 255, 255);
  doc.text(d.kind === "in" ? "OFFICIAL CASH RECEIPT" : "CASH PAYMENT RECEIPT", pw / 2, y + 6, { align: "center" });
  y += 13;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    body: [
      ["Voucher No.", d.voucherNo, "Date & Time", d.dateTime],
      ["Business Date", d.businessDate, "Category", d.typeLabel],
      ["Issued By", d.issuedBy || "—", "Received By", d.receivedBy || "—"],
      ["Reference", d.reference || "—", "Amount", money(d.amount)],
      [{ content: "Reason / Purpose", styles: { fontStyle: "bold" as const, fillColor: [240, 245, 250] as [number, number, number] } }, { content: d.reason || "—", colSpan: 3 }],
      [{ content: "Amount in words", styles: { fontStyle: "bold" as const, fillColor: [240, 245, 250] as [number, number, number] } }, { content: `${cur} ${amountInWords(d.amount)}`, colSpan: 3 }],
    ],
    theme: "grid",
    styles: { fontSize: 9.5, cellPadding: 3, lineColor: [210, 210, 210], textColor: [30, 30, 30] },
    columnStyles: {
      0: { fontStyle: "bold", fillColor: [240, 245, 250], cellWidth: 34 },
      2: { fontStyle: "bold", fillColor: [240, 245, 250], cellWidth: 34 },
    },
  });
  // @ts-ignore
  y = doc.lastAutoTable.finalY + 10;

  doc.setFillColor(240, 245, 250);
  doc.rect(margin, y, pw - 2 * margin, 14, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...PRIMARY);
  doc.text(`${d.kind === "in" ? "AMOUNT RECEIVED" : "AMOUNT PAID OUT"}: ${money(d.amount)}`, pw / 2, y + 9, { align: "center" });
  y += 22;

  // Official stamp box
  const stampW = 56;
  const stampH = 34;
  const stampX = pw - margin - stampW;
  doc.setDrawColor(160, 160, 160);
  doc.setLineWidth(0.4);
  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.rect(stampX, y, stampW, stampH);
  doc.setLineDashPattern([], 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(150, 150, 150);
  doc.text("OFFICIAL STAMP", stampX + stampW / 2, y + stampH / 2 + 1, { align: "center" });

  const sigY = y + stampH - 4;
  const colW = (pw - 2 * margin - stampW - 6) / 2;
  [`Issued By: ${d.issuedBy || ""}`, `Received By: ${d.receivedBy || ""}`].forEach((label, i) => {
    const x = margin + i * colW;
    doc.setDrawColor(120, 120, 120);
    doc.line(x, sigY, x + colW - 8, sigY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(label, x, sigY + 4.5);
    doc.text("Signature & Date", x, sigY + 9);
  });
  y = sigY;

  doc.setFontSize(7.5);
  doc.setTextColor(120, 120, 120);
  doc.text(`Generated ${new Date().toLocaleString()} • Progress Christian Centre Accounts`, pw / 2, 287, { align: "center" });

  doc.save(`${d.kind === "in" ? "Cash_Received" : "Cash_Payment"}_Receipt_${d.voucherNo}.pdf`);
};

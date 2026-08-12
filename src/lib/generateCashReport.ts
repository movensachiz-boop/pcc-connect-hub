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

  // Reconciliation — only physical cash sits in the drawer
  const isCash = (m: string) => /cash/i.test(m || "") && !/cashier/i.test(m || "");
  const cashIn = d.receipts.filter((r) => isCash(r.method)).reduce((s, r) => s + Number(r.amount || 0), 0);
  const nonCashIn = totalIn - cashIn;
  const expected = Number(d.openingFloat || 0) + cashIn - totalOut;
  const counted = d.closingCounted == null ? null : Number(d.closingCounted);
  const variance = counted == null ? null : counted - expected;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["RECONCILIATION (CASH DRAWER)", "Amount"]],
    body: [
      ["Opening float", money(d.openingFloat)],
      ["Add: cash received", money(cashIn)],
      ["Less: total disbursed / banked", `(${money(totalOut)})`],
      ["Expected cash on hand", money(expected)],
      ["Actual cash counted at close", counted == null ? "—" : money(counted)],
      ["Variance (over / short)", variance == null ? "—" : money(variance)],
      ["Non-cash received (bank / swipe / mobile)", money(nonCashIn)],
      ["Total received (all methods)", money(totalIn)],
    ],
    theme: "grid",
    headStyles: { fillColor: [...PRIMARY], textColor: [255, 255, 255], fontSize: 9 },
    bodyStyles: { fontSize: 9, cellPadding: 2.4 },
    columnStyles: { 0: { cellWidth: pw - 2 * margin - 45 }, 1: { halign: "right", cellWidth: 45, fontStyle: "bold" } },
    didParseCell: (h) => {
      if (h.section === "body" && h.row.index >= 6) {
        h.cell.styles.textColor = [110, 110, 110];
        h.cell.styles.fontStyle = h.column.index === 1 ? "normal" : "italic";
      }
    },
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

const TW = 80; // 80mm thermal roll
const TM = 4;

const renderVoucherThermal = async (
  doc: jsPDF,
  d: MovementVoucherData,
  logo: HTMLImageElement | null,
) => {
  const cw = TW - TM * 2;
  const cx = TW / 2;
  const cur = d.currency || "USD";
  const money = (n: number) => `${cur} ${Number(n || 0).toFixed(2)}`;
  let y = 5;

  const dashed = (yPos: number) => {
    doc.setDrawColor(0);
    doc.setLineWidth(0.1);
    for (let x = TM; x < TW - TM; x += 2) doc.line(x, yPos, Math.min(x + 1, TW - TM), yPos);
  };

  const centered = (text: string, size: number, style: "normal" | "bold" = "normal", gap = 3.6) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(0);
    (doc.splitTextToSize(text, cw) as string[]).forEach((line) => {
      doc.text(line, cx, y, { align: "center" });
      y += gap;
    });
  };

  const row = (label: string, value: string) => {
    const valueX = 26;
    const lines = doc.splitTextToSize(value || "-", TW - valueX - TM) as string[];
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(80);
    doc.text(label, TM, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    lines.forEach((line, i) => doc.text(line, TW - TM, y + i * 3.4, { align: "right" }));
    y += Math.max(4.2, lines.length * 3.4);
  };

  if (logo) {
    doc.addImage(logo, "PNG", cx - 8, y, 16, 16);
    y += 18;
  }

  centered("PROGRESS CHRISTIAN CENTRE", 9, "bold", 4);
  centered("11729 Mkoba 14, Gweru, Zimbabwe", 6.2, "normal", 3.2);
  centered("Tel: +263 77 400 0143", 6.2, "normal", 3.2);
  y += 1;

  dashed(y);
  y += 4;
  centered(d.kind === "in" ? "OFFICIAL CASH RECEIPT" : "CASH PAYMENT RECEIPT", 9, "bold", 4.4);
  dashed(y);
  y += 4;

  row("Receipt No:", d.voucherNo);
  row("Date/Time:", d.dateTime);
  row("Business Date:", d.businessDate);
  row("Category:", d.typeLabel);
  if (d.kind === "in") {
    row("Received From:", d.issuedBy || "—");
    row("Received By (Cashier):", d.receivedBy || "—");
  } else {
    row("Issued By (Cashier):", d.issuedBy || "—");
    row("Paid To:", d.receivedBy || "—");
  }
  if (d.reference) row("Reference:", d.reference);
  if (d.reason) row("Reason:", d.reason);

  y += 1;
  dashed(y);
  y += 4.5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(0);
  doc.text(d.kind === "in" ? "AMOUNT RECEIVED" : "AMOUNT PAID OUT", TM, y);
  doc.setFontSize(11);
  doc.text(money(d.amount), TW - TM, y, { align: "right" });
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(70);
  (doc.splitTextToSize(`${cur} ${amountInWords(d.amount)}`, cw) as string[]).forEach((line) => {
    doc.text(line, cx, y, { align: "center" });
    y += 3;
  });

  y += 1.5;
  dashed(y);
  y += 5;

  // Stamp box
  const stampW = 34;
  const stampH = 20;
  doc.setDrawColor(150);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([1.2, 1.2], 0);
  doc.rect(cx - stampW / 2, y, stampW, stampH);
  doc.setLineDashPattern([], 0);
  doc.setFontSize(6);
  doc.setTextColor(150);
  doc.text("OFFICIAL STAMP", cx, y + stampH / 2 + 1, { align: "center" });
  y += stampH + 7;

  // Signature lines
  doc.setDrawColor(120);
  doc.setLineWidth(0.2);
  (d.kind === "in"
    ? [["Received From", d.issuedBy], ["Received By (Cashier)", d.receivedBy]]
    : [["Issued By (Cashier)", d.issuedBy], ["Paid To", d.receivedBy]]
  ).forEach(([label, name]) => {
    doc.line(TM, y, TW - TM, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(80);
    doc.text(`${label}: ${name || ""}`, TM, y + 3.2);
    doc.text("Signature & Date", TW - TM, y + 3.2, { align: "right" });
    y += 10;
  });

  dashed(y);
  y += 4;
  doc.setFontSize(5.5);
  doc.setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleString()}`, cx, y, { align: "center" });
  y += 3;
  doc.text("Progress Christian Centre Accounts", cx, y, { align: "center" });
  y += 3;

  return y;
};

export const generateMovementVoucher = async (
  d: MovementVoucherData,
  mode: "save" | "print" = "print",
) => {
  const printWindow = mode === "print" ? window.open("", "_blank") : null;

  let logo: HTMLImageElement | null = null;
  try {
    const logoModule = await import("@/assets/pcc-logo.png");
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject();
      img.src = logoModule.default;
    });
    logo = img;
  } catch {}

  const measuring = new jsPDF({ unit: "mm", format: [TW, 500] });
  const measured = await renderVoucherThermal(measuring, d, logo);
  const height = Math.max(120, Math.ceil(measured + 8));
  const doc = new jsPDF({ unit: "mm", format: [TW, height] });
  await renderVoucherThermal(doc, d, logo);

  const fileName = `${d.kind === "in" ? "Cash_Received" : "Cash_Payment"}_Receipt_${d.voucherNo}.pdf`;

  if (mode !== "print") {
    doc.save(fileName);
    return;
  }

  doc.autoPrint();
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const target = printWindow || window.open(url, "_blank");
  if (!target) {
    URL.revokeObjectURL(url);
    doc.save(fileName);
    return;
  }
  if (printWindow) target.location.href = url;
  let started = false;
  const startPrint = () => {
    if (started) return;
    started = true;
    target.focus();
    target.print();
  };
  target.onload = () => window.setTimeout(startPrint, 350);
  target.onafterprint = () => {
    target.close();
    URL.revokeObjectURL(url);
  };
  window.setTimeout(startPrint, 900);
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
};


// ── 80mm thermal version of the daily cash & accounting report ──
const renderCashReportThermal = (doc: jsPDF, d: CashReportData, logo: HTMLImageElement | null) => {
  const cw = TW - TM * 2;
  const cx = TW / 2;
  const cur = d.currency || "USD";
  const money = (n: number) => `${cur} ${Number(n || 0).toFixed(2)}`;
  let y = 5;

  const dashed = () => {
    doc.setDrawColor(0);
    doc.setLineWidth(0.1);
    for (let x = TM; x < TW - TM; x += 2) doc.line(x, y, Math.min(x + 1, TW - TM), y);
    y += 3.5;
  };

  const centered = (text: string, size: number, style: "normal" | "bold" = "normal", gap = 3.4) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(0);
    (doc.splitTextToSize(text, cw) as string[]).forEach((line) => {
      doc.text(line, cx, y, { align: "center" });
      y += gap;
    });
  };

  const row = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(80);
    doc.text(label, TM, y);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(0);
    const lines = doc.splitTextToSize(value || "-", TW - 30 - TM) as string[];
    lines.forEach((line, i) => doc.text(line, TW - TM, y + i * 3.2, { align: "right" }));
    y += Math.max(4, lines.length * 3.2);
  };

  const lineItem = (left: string, right: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.2);
    doc.setTextColor(40);
    const lines = doc.splitTextToSize(left, cw - 20) as string[];
    lines.forEach((l, i) => doc.text(l, TM, y + i * 2.9));
    doc.text(right, TW - TM, y, { align: "right" });
    y += Math.max(3.4, lines.length * 2.9);
  };

  if (logo) {
    doc.addImage(logo, "PNG", cx - 8, y, 16, 16);
    y += 18;
  }

  centered("PROGRESS CHRISTIAN CENTRE", 9, "bold", 4);
  centered("11729 Mkoba 14, Gweru, Zimbabwe", 6, "normal", 3);
  centered("Tel: +263 77 400 0143", 6, "normal", 3.2);
  dashed();
  centered("DAILY CASH & ACCOUNTING REPORT", 8.5, "bold", 4);
  dashed();

  row("Cashier:", d.cashierName, true);
  row("Business Date:", d.businessDate, true);
  row("Day Opened:", d.openedAt || "—");
  row("Day Closed:", d.closedAt || "Still open");
  dashed();

  const totalIn = d.receipts.reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalOut = d.outflows.reduce((s, r) => s + Number(r.amount || 0), 0);

  centered("A. MONEY RECEIVED", 7.5, "bold", 4);
  if (!d.receipts.length) {
    centered("No receipts recorded", 6, "normal", 3.4);
  } else {
    d.receipts.forEach((r) => lineItem(`${r.time}  ${r.description} (${r.method})`, money(r.amount)));
  }
  y += 0.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(0);
  doc.text("TOTAL RECEIVED", TM, y);
  doc.text(money(totalIn), TW - TM, y, { align: "right" });
  y += 4;
  dashed();

  centered("B. MONEY DISBURSED / BANKED", 7.5, "bold", 4);
  if (!d.outflows.length) {
    centered("No disbursements recorded", 6, "normal", 3.4);
  } else {
    d.outflows.forEach((o) => lineItem(`${o.time}  ${o.type} — ${o.recipient}`, money(o.amount)));
  }
  y += 0.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("TOTAL DISBURSED", TM, y);
  doc.text(money(totalOut), TW - TM, y, { align: "right" });
  y += 4;
  dashed();

  const isCash = (m: string) => /cash/i.test(m || "") && !/cashier/i.test(m || "");
  const cashIn = d.receipts.filter((r) => isCash(r.method)).reduce((s, r) => s + Number(r.amount || 0), 0);
  const nonCashIn = totalIn - cashIn;
  const expected = Number(d.openingFloat || 0) + cashIn - totalOut;
  const counted = d.closingCounted == null ? null : Number(d.closingCounted);
  const variance = counted == null ? null : counted - expected;

  centered("RECONCILIATION (CASH DRAWER)", 7.5, "bold", 4);
  row("Opening float", money(d.openingFloat));
  row("Add: cash received", money(cashIn));
  row("Less: disbursed / banked", `(${money(totalOut)})`);
  row("Expected cash on hand", money(expected), true);
  row("Actual cash counted", counted == null ? "—" : money(counted), true);
  row("Variance (over/short)", variance == null ? "—" : money(variance), true);
  y += 1;
  row("Non-cash received", money(nonCashIn));
  row("Total received (all)", money(totalIn));
  dashed();

  if (d.notes) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(70);
    (doc.splitTextToSize(`Notes: ${d.notes}`, cw) as string[]).forEach((l) => {
      doc.text(l, TM, y);
      y += 3;
    });
    y += 1;
    dashed();
  }

  y += 3;
  doc.setDrawColor(120);
  doc.setLineWidth(0.2);
  ["Cashier (cash counted)", "Received By (transfers/cash)", "Verified By (Accounts)"].forEach((label) => {
    doc.line(TM, y, TW - TM, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.8);
    doc.setTextColor(80);
    doc.text(label, TM, y + 3);
    doc.text("Signature & Date", TW - TM, y + 3, { align: "right" });
    y += 9.5;
  });

  dashed();
  doc.setFontSize(5.5);
  doc.setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleString()}`, cx, y, { align: "center" });
  y += 3;
  doc.text("Progress Christian Centre Accounts", cx, y, { align: "center" });
  y += 3;

  return y;
};

export const generateThermalCashReport = async (
  d: CashReportData,
  mode: "save" | "print" = "print",
) => {
  const printWindow = mode === "print" ? window.open("", "_blank") : null;

  let logo: HTMLImageElement | null = null;
  try {
    const logoModule = await import("@/assets/pcc-logo.png");
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject();
      img.src = logoModule.default;
    });
    logo = img;
  } catch {}

  const measuring = new jsPDF({ unit: "mm", format: [TW, 2000] });
  const measured = renderCashReportThermal(measuring, d, logo);
  const height = Math.max(150, Math.ceil(measured + 10));
  const doc = new jsPDF({ unit: "mm", format: [TW, height] });
  renderCashReportThermal(doc, d, logo);

  const fileName = `Cash_Report_Thermal_${d.cashierName.replace(/\s+/g, "_")}_${d.businessDate}.pdf`;

  if (mode !== "print") {
    doc.save(fileName);
    return;
  }

  doc.autoPrint();
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const target = printWindow || window.open(url, "_blank");
  if (!target) {
    URL.revokeObjectURL(url);
    doc.save(fileName);
    return;
  }
  if (printWindow) target.location.href = url;
  let started = false;
  const startPrint = () => {
    if (started) return;
    started = true;
    target.focus();
    target.print();
  };
  target.onload = () => window.setTimeout(startPrint, 350);
  target.onafterprint = () => {
    target.close();
    URL.revokeObjectURL(url);
  };
  window.setTimeout(startPrint, 900);
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
};

// ── Shared thermal helpers for summary/accounts reports ──
const loadThermalLogo = async (): Promise<HTMLImageElement | null> => {
  try {
    const logoModule = await import("@/assets/pcc-logo.png");
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject();
      img.src = logoModule.default;
    });
    return img;
  } catch {
    return null;
  }
};

const printThermalDoc = (doc: jsPDF, fileName: string, mode: "save" | "print", printWindow: Window | null) => {
  if (mode !== "print") {
    doc.save(fileName);
    return;
  }
  doc.autoPrint();
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const target = printWindow || window.open(url, "_blank");
  if (!target) {
    URL.revokeObjectURL(url);
    doc.save(fileName);
    return;
  }
  if (printWindow) target.location.href = url;
  let started = false;
  const startPrint = () => {
    if (started) return;
    started = true;
    target.focus();
    target.print();
  };
  target.onload = () => window.setTimeout(startPrint, 350);
  target.onafterprint = () => {
    target.close();
    URL.revokeObjectURL(url);
  };
  window.setTimeout(startPrint, 900);
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
};

const thermalKit = (doc: jsPDF) => {
  const cw = TW - TM * 2;
  const cx = TW / 2;
  const state = { y: 5 };
  const dashed = () => {
    doc.setDrawColor(0);
    doc.setLineWidth(0.1);
    for (let x = TM; x < TW - TM; x += 2) doc.line(x, state.y, Math.min(x + 1, TW - TM), state.y);
    state.y += 3.5;
  };
  const centered = (text: string, size: number, style: "normal" | "bold" = "normal", gap = 3.4) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(0);
    (doc.splitTextToSize(text, cw) as string[]).forEach((line) => {
      doc.text(line, cx, state.y, { align: "center" });
      state.y += gap;
    });
  };
  const row = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(80);
    doc.text(label, TM, state.y);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(0);
    const lines = doc.splitTextToSize(value || "-", TW - 30 - TM) as string[];
    lines.forEach((line, i) => doc.text(line, TW - TM, state.y + i * 3.2, { align: "right" }));
    state.y += Math.max(4, lines.length * 3.2);
  };
  const lineItem = (left: string, right: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.2);
    doc.setTextColor(40);
    const lines = doc.splitTextToSize(left, cw - 20) as string[];
    lines.forEach((l, i) => doc.text(l, TM, state.y + i * 2.9));
    doc.text(right, TW - TM, state.y, { align: "right" });
    state.y += Math.max(3.4, lines.length * 2.9);
  };
  const header = (logo: HTMLImageElement | null, title: string) => {
    if (logo) {
      doc.addImage(logo, "PNG", cx - 8, state.y, 16, 16);
      state.y += 18;
    }
    centered("PROGRESS CHRISTIAN CENTRE", 9, "bold", 4);
    centered("11729 Mkoba 14, Gweru, Zimbabwe", 6, "normal", 3);
    centered("Tel: +263 77 400 0143", 6, "normal", 3.2);
    dashed();
    centered(title, 8.5, "bold", 4);
    dashed();
  };
  const signatures = (labels: string[]) => {
    state.y += 3;
    doc.setDrawColor(120);
    doc.setLineWidth(0.2);
    labels.forEach((label) => {
      doc.line(TM, state.y, TW - TM, state.y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.8);
      doc.setTextColor(80);
      doc.text(label, TM, state.y + 3);
      doc.text("Signature & Date", TW - TM, state.y + 3, { align: "right" });
      state.y += 9.5;
    });
    dashed();
    doc.setFontSize(5.5);
    doc.setTextColor(120);
    doc.text(`Generated ${new Date().toLocaleString()}`, cx, state.y, { align: "center" });
    state.y += 3;
    doc.text("Progress Christian Centre Accounts", cx, state.y, { align: "center" });
    state.y += 3;
  };
  return { state, dashed, centered, row, lineItem, header, signatures };
};

// ── 80mm thermal: cash collection summary (accounts) ──
const renderPeriodThermal = (
  doc: jsPDF,
  rows: PeriodRow[],
  fromDate: string,
  toDate: string,
  currency: string,
  logo: HTMLImageElement | null,
) => {
  const k = thermalKit(doc);
  const money = (n: number) => `${currency} ${Number(n || 0).toFixed(2)}`;
  k.header(logo, "CASH COLLECTION SUMMARY");
  k.row("Period from:", fromDate, true);
  k.row("Period to:", toDate, true);
  k.dashed();

  const tIn = rows.reduce((s, r) => s + r.received, 0);
  const tOut = rows.reduce((s, r) => s + r.disbursed, 0);

  if (!rows.length) {
    k.centered("No sessions in this period", 6, "normal", 3.6);
  } else {
    rows.forEach((r) => {
      k.lineItem(`${r.date}  ${r.cashier}`, money(r.net));
      k.lineItem(`   In ${money(r.received)} / Out ${money(r.disbursed)}`, "");
    });
  }
  k.dashed();
  k.row("Total received", money(tIn), true);
  k.row("Total disbursed", `(${money(tOut)})`, true);
  k.row("OVERALL NET", money(tIn - tOut), true);
  k.dashed();
  k.signatures(["Prepared By (Cashier / Accounts)", "Approved By (Administrator)"]);
  return k.state.y;
};

export const generateThermalPeriodCashReport = async (
  rows: PeriodRow[],
  fromDate: string,
  toDate: string,
  currency = "USD",
  mode: "save" | "print" = "print",
) => {
  const printWindow = mode === "print" ? window.open("", "_blank") : null;
  const logo = await loadThermalLogo();
  const measuring = new jsPDF({ unit: "mm", format: [TW, 3000] });
  const measured = renderPeriodThermal(measuring, rows, fromDate, toDate, currency, logo);
  const height = Math.max(120, Math.ceil(measured + 8));
  const doc = new jsPDF({ unit: "mm", format: [TW, height] });
  renderPeriodThermal(doc, rows, fromDate, toDate, currency, logo);
  printThermalDoc(doc, `Cash_Summary_Thermal_${fromDate}_to_${toDate}.pdf`, mode, printWindow);
};

// ── 80mm thermal: inventory accounts report ──
const renderInventoryThermal = (
  doc: jsPDF,
  rows: InventoryReportRow[],
  periodLabel: string,
  totals: { salesThisPeriod: number; priorTermSettled: number; stockValue: number },
  currency: string,
  logo: HTMLImageElement | null,
) => {
  const k = thermalKit(doc);
  const money = (n: number) => `${currency} ${Number(n || 0).toFixed(2)}`;
  k.header(logo, "INVENTORY ACCOUNTS REPORT");
  k.row("Period:", periodLabel, true);
  k.dashed();

  const sold = rows.filter((r) => r.soldQty > 0);
  k.centered("ITEMS SOLD", 7.5, "bold", 4);
  if (!sold.length) {
    k.centered("No sales in this period", 6, "normal", 3.6);
  } else {
    sold.forEach((r) => k.lineItem(`${r.name} x${r.soldQty} (${r.category})`, money(r.soldValue)));
  }
  k.dashed();
  k.row("Sales this period", money(totals.salesThisPeriod), true);
  k.row("Prior-term settled", money(totals.priorTermSettled));
  k.row("Stock value on hand", money(totals.stockValue), true);
  k.dashed();
  k.centered("STOCK ON HAND", 7.5, "bold", 4);
  rows.forEach((r) => k.lineItem(`${r.name}`, `${r.stock} @ ${money(r.price)}`));
  k.dashed();
  k.signatures(["Storekeeper", "Verified By (Accounts)"]);
  return k.state.y;
};

export const generateThermalInventoryReport = async (
  rows: InventoryReportRow[],
  periodLabel: string,
  totals: { salesThisPeriod: number; priorTermSettled: number; stockValue: number },
  currency = "USD",
  mode: "save" | "print" = "print",
) => {
  const printWindow = mode === "print" ? window.open("", "_blank") : null;
  const logo = await loadThermalLogo();
  const measuring = new jsPDF({ unit: "mm", format: [TW, 3000] });
  const measured = renderInventoryThermal(measuring, rows, periodLabel, totals, currency, logo);
  const height = Math.max(120, Math.ceil(measured + 8));
  const doc = new jsPDF({ unit: "mm", format: [TW, height] });
  renderInventoryThermal(doc, rows, periodLabel, totals, currency, logo);
  printThermalDoc(doc, `Inventory_Report_Thermal_${periodLabel.replace(/\s+/g, "_")}.pdf`, mode, printWindow);
};

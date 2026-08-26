import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface FeesReportStudent {
  id: string;
  name: string;
  regNo: string;
  className: string;
  expected: number;
  paid: number;
  guardianPhone?: string | null;
}
export interface FeesReportPayment {
  amount: number;
  created_at: string;
}

const NAVY: [number, number, number] = [0, 51, 102];
const GOLD: [number, number, number] = [212, 175, 55];
const GREEN: [number, number, number] = [34, 160, 94];
const RED: [number, number, number] = [200, 45, 45];
const BLUE: [number, number, number] = [40, 110, 200];
const PALETTE: [number, number, number][] = [NAVY, GOLD, GREEN, RED, BLUE, [140, 80, 190], [230, 130, 40]];

const weekStart = (iso: string) => {
  const d = new Date(iso);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
};

const barChart = (
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  data: { name: string; value: number }[],
  colors: [number, number, number][],
  valueFmt: (v: number) => string = (v) => String(v)
) => {
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.text(title, x, y - 2);
  doc.setFont("helvetica", "normal");
  doc.setFillColor(250, 250, 252);
  doc.setDrawColor(215, 217, 225);
  doc.roundedRect(x, y, w, h, 2, 2, "FD");
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = Math.max(1, data.length);
  const slot = w / n;
  const bw = Math.min(slot * 0.6, 16);
  data.forEach((d, i) => {
    const bh = (d.value / max) * (h - 14);
    const bx = x + i * slot + (slot - bw) / 2;
    const by = y + h - 9 - bh;
    doc.setFillColor(...colors[i % colors.length]);
    doc.rect(bx, by, bw, Math.max(bh, 0.6), "F");
    doc.setFontSize(6.2);
    doc.setTextColor(60, 60, 70);
    doc.text(valueFmt(d.value), bx + bw / 2, by - 1.4, { align: "center" });
    const label = d.name.length > 13 ? d.name.slice(0, 12) + "…" : d.name;
    doc.text(label, x + i * slot + slot / 2, y + h - 3, { align: "center" });
  });
  doc.setTextColor(0, 0, 0);
};

const donut = (
  doc: jsPDF,
  cx: number,
  cy: number,
  r: number,
  title: string,
  parts: { name: string; value: number; color: [number, number, number] }[]
) => {
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.text(title, cx - r, cy - r - 4);
  doc.setFont("helvetica", "normal");
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  let angle = -Math.PI / 2;
  parts.forEach((p) => {
    const sweep = (p.value / total) * Math.PI * 2;
    const steps = Math.max(2, Math.ceil((sweep / (Math.PI * 2)) * 60));
    doc.setFillColor(...p.color);
    for (let i = 0; i < steps; i++) {
      const a1 = angle + (sweep * i) / steps;
      const a2 = angle + (sweep * (i + 1)) / steps;
      doc.triangle(cx, cy, cx + r * Math.cos(a1), cy + r * Math.sin(a1), cx + r * Math.cos(a2), cy + r * Math.sin(a2), "F");
    }
    angle += sweep;
  });
  let ly = cy - r + 2;
  parts.forEach((p) => {
    doc.setFillColor(...p.color);
    doc.rect(cx + r + 6, ly - 2.6, 3.2, 3.2, "F");
    doc.setFontSize(7.5);
    doc.setTextColor(60, 60, 70);
    doc.text(`${p.name}: ${p.value} (${Math.round((p.value / total) * 100)}%)`, cx + r + 11, ly);
    ly += 6;
  });
  doc.setTextColor(0, 0, 0);
};

export const generateFeesReport = (
  students: FeesReportStudent[],
  payments: FeesReportPayment[],
  termName?: string
) => {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const generated = new Date().toLocaleString();

  const fullyPaid = students.filter((s) => s.expected > 0 && s.paid >= s.expected);
  const partial = students.filter((s) => s.paid > 0 && (s.expected <= 0 || s.paid < s.expected));
  const unpaid = students.filter((s) => s.paid <= 0);

  const totalExpected = students.reduce((t, s) => t + (s.expected || 0), 0);
  const totalCollected = students.reduce((t, s) => t + (s.paid || 0), 0);
  const outstanding = students.reduce((t, s) => t + Math.max(0, (s.expected || 0) - (s.paid || 0)), 0);
  const rate = totalExpected ? Math.round((totalCollected / totalExpected) * 100) : 0;

  // per week
  const weekMap: Record<string, { count: number; amount: number }> = {};
  payments.forEach((p) => {
    const k = weekStart(p.created_at);
    weekMap[k] = weekMap[k] || { count: 0, amount: 0 };
    weekMap[k].count += 1;
    weekMap[k].amount += Number(p.amount || 0);
  });
  const weeks = Object.entries(weekMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => ({ key: k, ...v }))
    .slice(-10);
  const busiest = weeks.reduce<{ key: string; count: number; amount: number } | null>(
    (best, w) => (!best || w.count > best.count ? w : best),
    null
  );
  const weekLabel = (k: string) => {
    const d = new Date(k);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  // per class collection
  const classMap: Record<string, { expected: number; collected: number; students: number; paid: number }> = {};
  students.forEach((s) => {
    const c = s.className || "Unassigned";
    classMap[c] = classMap[c] || { expected: 0, collected: 0, students: 0, paid: 0 };
    classMap[c].expected += s.expected || 0;
    classMap[c].collected += s.paid || 0;
    classMap[c].students += 1;
    if (s.expected > 0 && s.paid >= s.expected) classMap[c].paid += 1;
  });
  const classes = Object.entries(classMap).sort(([a], [b]) => a.localeCompare(b));

  // ---------- Page 1 ----------
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, 210, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Progress Centre College", 14, 11);
  doc.setFontSize(10.5);
  doc.setFont("helvetica", "normal");
  doc.text(`Fees Collection Analysis Report${termName ? ` — ${termName}` : ""}`, 14, 18);
  doc.setFontSize(8);
  doc.text(generated, 196, 18, { align: "right" });
  doc.setTextColor(0, 0, 0);

  let y = 34;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text("Introduction & Statistics", 14, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 70);
  doc.setFontSize(9);
  y += 6;
  doc.text(
    `This report covers ${students.length} enrolled student(s) across ${classes.length} class(es)` +
      `${termName ? ` for ${termName}` : ""}. A total of ${payments.length} payment(s) worth ` +
      `$${totalCollected.toFixed(2)} has been received against an expected $${totalExpected.toFixed(2)}, ` +
      `a collection rate of ${rate}%, leaving $${outstanding.toFixed(2)} outstanding. ` +
      `${fullyPaid.length} student(s) have settled in full, ${partial.length} have paid in part and ` +
      `${unpaid.length} have not paid at all. ` +
      (busiest
        ? `The busiest week began ${busiest.key} with ${busiest.count} payment(s) totalling $${busiest.amount.toFixed(2)}.`
        : ""),
    14,
    y,
    { maxWidth: 182 }
  );

  y += 22;
  const boxes: [string, string, [number, number, number]][] = [
    ["Students", String(students.length), NAVY],
    ["Paid in Full", String(fullyPaid.length), GREEN],
    ["Part Paid", String(partial.length), GOLD],
    ["Not Paid", String(unpaid.length), RED],
  ];
  boxes.forEach(([label, value, color], i) => {
    const bx = 14 + i * 46.5;
    doc.setFillColor(248, 249, 252);
    doc.setDrawColor(220, 222, 230);
    doc.roundedRect(bx, y, 43, 17, 2, 2, "FD");
    doc.setFillColor(...color);
    doc.rect(bx, y, 2, 17, "F");
    doc.setFontSize(7);
    doc.setTextColor(110, 115, 130);
    doc.text(label.toUpperCase(), bx + 5, y + 6);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...color);
    doc.text(value, bx + 5, y + 13.5);
    doc.setFont("helvetica", "normal");
  });
  doc.setTextColor(0, 0, 0);

  y += 24;
  const money: [string, string][] = [
    ["Expected", `$${totalExpected.toFixed(2)}`],
    ["Collected", `$${totalCollected.toFixed(2)}`],
    ["Outstanding", `$${outstanding.toFixed(2)}`],
    ["Collection Rate", `${rate}%`],
  ];
  money.forEach(([label, value], i) => {
    const bx = 14 + i * 46.5;
    doc.setFillColor(...(i === 1 ? GREEN : i === 2 ? RED : NAVY));
    doc.roundedRect(bx, y, 43, 15, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.text(label.toUpperCase(), bx + 4, y + 5.5);
    doc.setFontSize(11.5);
    doc.setFont("helvetica", "bold");
    doc.text(value, bx + 4, y + 12);
    doc.setFont("helvetica", "normal");
  });
  doc.setTextColor(0, 0, 0);

  y += 27;
  barChart(
    doc,
    14,
    y,
    182,
    44,
    "Payments per Week (number of payments)",
    weeks.map((w) => ({ name: `wk ${weekLabel(w.key)}`, value: w.count })),
    PALETTE
  );

  y += 54;
  barChart(
    doc,
    14,
    y,
    182,
    44,
    "Amount Collected per Week (USD)",
    weeks.map((w) => ({ name: `wk ${weekLabel(w.key)}`, value: Math.round(w.amount) })),
    [GOLD, GREEN, BLUE, NAVY],
    (v) => `$${v}`
  );

  y += 56;
  donut(doc, 40, y + 18, 17, "Payment Status", [
    { name: "Paid", value: fullyPaid.length, color: GREEN },
    { name: "Part", value: partial.length, color: GOLD },
    { name: "Unpaid", value: unpaid.length, color: RED },
  ]);
  donut(doc, 128, y + 18, 17, "Collected vs Outstanding ($)", [
    { name: "Collected", value: Math.round(totalCollected), color: GREEN },
    { name: "Outstanding", value: Math.round(outstanding), color: RED },
  ]);

  // ---------- Page 2: per class summary ----------
  doc.addPage();
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, 210, 16, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Collection Summary by Class", 14, 10.5);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  autoTable(doc, {
    startY: 22,
    head: [["Class", "Students", "Fully Paid", "Expected ($)", "Collected ($)", "Outstanding ($)", "Rate"]],
    body: classes.map(([c, v]) => [
      c,
      String(v.students),
      String(v.paid),
      v.expected.toFixed(2),
      v.collected.toFixed(2),
      Math.max(0, v.expected - v.collected).toFixed(2),
      `${v.expected ? Math.round((v.collected / v.expected) * 100) : 0}%`,
    ]),
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.6 },
    headStyles: { fillColor: NAVY, textColor: 255, fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 247, 252] },
    margin: { left: 14, right: 14 },
  });

  const head = [["Student", "Reg No.", "Class", "Expected", "Paid", "Balance"]];
  const rowFor = (s: FeesReportStudent) => [
    s.name,
    s.regNo,
    s.className,
    `$${(s.expected || 0).toFixed(2)}`,
    `$${(s.paid || 0).toFixed(2)}`,
    `$${Math.max(0, (s.expected || 0) - (s.paid || 0)).toFixed(2)}`,
  ];
  const byName = (a: FeesReportStudent, b: FeesReportStudent) => a.name.localeCompare(b.name);

  // ---------- Page 3: fully paid ----------
  doc.addPage();
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, 210, 16, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Students Who Have Paid in Full (${fullyPaid.length})`, 14, 10.5);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  autoTable(doc, {
    startY: 22,
    head,
    body: [...fullyPaid].sort(byName).map(rowFor),
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.6 },
    headStyles: { fillColor: GREEN, textColor: 255, fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 250, 246] },
    margin: { left: 14, right: 14 },
  });

  // ---------- Page 4: part paid ----------
  doc.addPage();
  doc.setFillColor(...GOLD);
  doc.rect(0, 0, 210, 16, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Students Who Paid in Part (${partial.length})`, 14, 10.5);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  autoTable(doc, {
    startY: 22,
    head,
    body: [...partial].sort(byName).map(rowFor),
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.6 },
    headStyles: { fillColor: GOLD, textColor: 255, fontSize: 8 },
    alternateRowStyles: { fillColor: [255, 250, 240] },
    margin: { left: 14, right: 14 },
  });

  // ---------- Page 5: unpaid ----------
  doc.addPage();
  doc.setFillColor(...RED);
  doc.rect(0, 0, 210, 16, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Students Who Have Not Paid (${unpaid.length})`, 14, 10.5);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  autoTable(doc, {
    startY: 22,
    head: [["Student", "Reg No.", "Class", "Expected", "Guardian Phone"]],
    body: [...unpaid].sort(byName).map((s) => [
      s.name,
      s.regNo,
      s.className,
      `$${(s.expected || 0).toFixed(2)}`,
      s.guardianPhone || "—",
    ]),
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.6 },
    headStyles: { fillColor: RED, textColor: 255, fontSize: 8 },
    alternateRowStyles: { fillColor: [253, 245, 245] },
    margin: { left: 14, right: 14 },
  });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(130, 130, 140);
    doc.text(`Progress Centre College · Fees Collection · Page ${i} of ${pages}`, 105, 289, { align: "center" });
  }

  doc.save(`fees_collection_report_${new Date().toISOString().slice(0, 10)}.pdf`);
};

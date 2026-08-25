import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface VacReportStudent {
  id: string;
  first_name: string;
  last_name: string;
  stream: string;
  guardian_phone?: string | null;
}
export interface VacReportPayment {
  vacation_student_id: string;
  amount: number;
  created_at: string;
  receipt_number?: string | null;
  method?: string;
}

const NAVY: [number, number, number] = [0, 51, 102];
const GOLD: [number, number, number] = [212, 175, 55];
const GREEN: [number, number, number] = [34, 160, 94];
const RED: [number, number, number] = [200, 45, 45];
const BLUE: [number, number, number] = [40, 110, 200];
const PALETTE: [number, number, number][] = [NAVY, GOLD, GREEN, RED, BLUE, [140, 80, 190], [230, 130, 40]];

const isExternal = (stream?: string) => (stream || "").toLowerCase().includes("external");
const expectedFor = (stream?: string) => (isExternal(stream) ? 60 : 50);
const fullName = (s: VacReportStudent) => `${s.first_name} ${s.last_name}`.trim();

/** ISO-ish week start (Monday) label for a date */
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
  // approximate pie using triangle fan
  let angle = -Math.PI / 2;
  parts.forEach((p) => {
    const sweep = (p.value / total) * Math.PI * 2;
    const steps = Math.max(2, Math.ceil((sweep / (Math.PI * 2)) * 60));
    doc.setFillColor(...p.color);
    for (let i = 0; i < steps; i++) {
      const a1 = angle + (sweep * i) / steps;
      const a2 = angle + (sweep * (i + 1)) / steps;
      doc.triangle(
        cx,
        cy,
        cx + r * Math.cos(a1),
        cy + r * Math.sin(a1),
        cx + r * Math.cos(a2),
        cy + r * Math.sin(a2),
        "F"
      );
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

export const generateVacationReport = (
  students: VacReportStudent[],
  payments: VacReportPayment[]
) => {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const generated = new Date().toLocaleString();

  const paidByStudent: Record<string, number> = {};
  payments.forEach((p) => {
    paidByStudent[p.vacation_student_id] = (paidByStudent[p.vacation_student_id] || 0) + Number(p.amount || 0);
  });

  const paidStudents = students.filter((s) => (paidByStudent[s.id] || 0) >= expectedFor(s.stream));
  const partialStudents = students.filter(
    (s) => (paidByStudent[s.id] || 0) > 0 && (paidByStudent[s.id] || 0) < expectedFor(s.stream)
  );
  const unpaidStudents = students.filter((s) => !(paidByStudent[s.id] > 0));

  const externals = students.filter((s) => isExternal(s.stream));
  const internals = students.filter((s) => !isExternal(s.stream));
  const totalExpected = students.reduce((s, st) => s + expectedFor(st.stream), 0);
  const totalCollected = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const outstanding = students.reduce(
    (s, st) => s + Math.max(0, expectedFor(st.stream) - (paidByStudent[st.id] || 0)),
    0
  );

  // Weekly aggregation
  const weekMap: Record<string, { count: number; amount: number }> = {};
  payments.forEach((p) => {
    const k = weekStart(p.created_at);
    weekMap[k] = weekMap[k] || { count: 0, amount: 0 };
    weekMap[k].count += 1;
    weekMap[k].amount += Number(p.amount || 0);
  });
  const weeks = Object.entries(weekMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => ({ key: k, ...v }));
  const busiest = weeks.reduce<{ key: string; count: number; amount: number } | null>(
    (best, w) => (!best || w.count > best.count ? w : best),
    null
  );
  const weekLabel = (k: string) => {
    const d = new Date(k);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  // ---------- Page 1: Introduction & charts ----------
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, 210, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Progress Centre College", 14, 11);
  doc.setFontSize(10.5);
  doc.setFont("helvetica", "normal");
  doc.text("Vacation School — Payments Analysis Report", 14, 18);
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
    `This report covers ${students.length} registered vacation school learners — ${externals.length} external ` +
      `(fee $60) and ${internals.length} internal (fee $50). A total of ${payments.length} payment(s) worth ` +
      `$${totalCollected.toFixed(2)} has been received against an expected $${totalExpected.toFixed(2)}, leaving ` +
      `$${outstanding.toFixed(2)} outstanding. ${paidStudents.length} learner(s) have settled in full, ` +
      `${partialStudents.length} have paid in part and ${unpaidStudents.length} have not paid at all. ` +
      (busiest
        ? `The busiest week began ${busiest.key} with ${busiest.count} payment(s) totalling $${busiest.amount.toFixed(2)}.`
        : ""),
    14,
    y,
    { maxWidth: 182 }
  );

  y += 22;
  const boxes: [string, string, [number, number, number]][] = [
    ["Learners", String(students.length), NAVY],
    ["Paid in Full", String(paidStudents.length), GREEN],
    ["Part Paid", String(partialStudents.length), GOLD],
    ["Not Paid", String(unpaidStudents.length), RED],
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
    ["Payments", String(payments.length)],
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
    46,
    "Payments per Week (number of learners paying)",
    weeks.map((w) => ({ name: `wk ${weekLabel(w.key)}`, value: w.count })),
    PALETTE
  );

  y += 56;
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

  y += 58;
  donut(doc, 40, y + 18, 17, "External vs Internal Learners", [
    { name: "External", value: externals.length, color: BLUE },
    { name: "Internal", value: internals.length, color: GOLD },
  ]);
  donut(doc, 128, y + 18, 17, "Payment Status", [
    { name: "Paid", value: paidStudents.length, color: GREEN },
    { name: "Part", value: partialStudents.length, color: GOLD },
    { name: "Unpaid", value: unpaidStudents.length, color: RED },
  ]);

  // ---------- Page 2: Paid list ----------
  const rowFor = (s: VacReportStudent) => {
    const paid = paidByStudent[s.id] || 0;
    const exp = expectedFor(s.stream);
    return [
      `${s.first_name} ${s.last_name}`.trim(),
      s.stream,
      isExternal(s.stream) ? "External" : "Internal",
      `$${exp.toFixed(2)}`,
      `$${paid.toFixed(2)}`,
      `$${Math.max(0, exp - paid).toFixed(2)}`,
    ];
  };
  const head = [["Learner", "Stream", "Type", "Expected", "Paid", "Balance"]];

  doc.addPage();
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, 210, 16, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Learners Who Have Paid (${paidStudents.length + partialStudents.length})`, 14, 10.5);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  autoTable(doc, {
    startY: 22,
    head,
    body: [...paidStudents, ...partialStudents]
      .sort((a, b) => fullName(a).localeCompare(fullName(b)))
      .map(rowFor),
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.6 },
    headStyles: { fillColor: GREEN, textColor: 255, fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 250, 246] },
    margin: { left: 14, right: 14 },
  });

  // ---------- Page 3: Unpaid list ----------
  doc.addPage();
  doc.setFillColor(...RED);
  doc.rect(0, 0, 210, 16, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Learners Who Have Not Paid (${unpaidStudents.length})`, 14, 10.5);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  autoTable(doc, {
    startY: 22,
    head: [["Learner", "Stream", "Type", "Expected", "Guardian Phone"]],
    body: unpaidStudents
      .sort((a, b) => fullName(a).localeCompare(fullName(b)))
      .map((s) => [
        fullName(s),
        s.stream,
        isExternal(s.stream) ? "External" : "Internal",
        `$${expectedFor(s.stream).toFixed(2)}`,
        s.guardian_phone || "—",
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
    doc.text(
      `Progress Centre College · Vacation School · Page ${i} of ${pages}`,
      105,
      289,
      { align: "center" }
    );
  }

  doc.save("vacation_school_payment_report.pdf");
};

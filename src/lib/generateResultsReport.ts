import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { ClassAnalytics, isPass } from "./examAnalytics";

export interface ResultsSection {
  className: string;
  term: string;
  examType: string;
  analytics: ClassAnalytics;
}

const NAVY: [number, number, number] = [0, 51, 102];
const GOLD: [number, number, number] = [212, 175, 55];

const header = (doc: jsPDF, title: string, subtitle: string) => {
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, 297, 20, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Progress Christian College", 14, 9);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(title, 14, 16);
  doc.setFontSize(8);
  doc.text(subtitle, 283, 16, { align: "right" });
  doc.setTextColor(0, 0, 0);
};

const statBox = (doc: jsPDF, x: number, y: number, w: number, label: string, value: string) => {
  doc.setFillColor(245, 246, 250);
  doc.setDrawColor(220, 222, 230);
  doc.roundedRect(x, y, w, 16, 2, 2, "FD");
  doc.setFontSize(7);
  doc.setTextColor(110, 115, 130);
  doc.text(label.toUpperCase(), x + 3, y + 5.5);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.text(value, x + 3, y + 12.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
};

/** Simple horizontal-baseline bar chart drawn with primitives. */
const barChart = (
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  data: { name: string; value: number }[],
  color: [number, number, number]
) => {
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.text(title, x, y - 2);
  doc.setFont("helvetica", "normal");
  doc.setDrawColor(210, 212, 220);
  doc.rect(x, y, w, h);
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = data.length || 1;
  const slot = w / n;
  const bw = Math.min(slot * 0.6, 18);
  data.forEach((d, i) => {
    const bh = (d.value / max) * (h - 12);
    const bx = x + i * slot + (slot - bw) / 2;
    const by = y + h - 8 - bh;
    doc.setFillColor(...color);
    doc.rect(bx, by, bw, Math.max(bh, 0.5), "F");
    doc.setFontSize(6.5);
    doc.setTextColor(70, 70, 80);
    doc.text(String(d.value), bx + bw / 2, by - 1.5, { align: "center" });
    const label = d.name.length > 12 ? d.name.slice(0, 11) + "…" : d.name;
    doc.text(label, x + i * slot + slot / 2, y + h - 2.5, { align: "center" });
  });
  doc.setTextColor(0, 0, 0);
};

export const generateResultsPDF = (sections: ResultsSection[], docTitle = "Exam Results Analysis") => {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const generated = new Date().toLocaleString();

  sections.forEach((section, idx) => {
    if (idx > 0) doc.addPage();
    const a = section.analytics;
    header(doc, `${docTitle} — ${section.className}`, `${section.term} · ${section.examType} · ${generated}`);

    let y = 26;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...NAVY);
    doc.text(`${section.className} — Statistical Overview`, 14, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 70);
    doc.setFontSize(8.5);
    y += 6;
    doc.text(
      `${a.entered} of ${a.students.length} learners have recorded marks across ${a.subjectNames.length} subject(s). ` +
        `The class average is ${a.classAverage}% with a pass rate of ${a.passRate}% (grade C or better). ` +
        (a.best ? `Top learner: ${a.best.name} (${a.best.average}%). ` : "") +
        (a.worst && a.worst !== a.best ? `Lowest: ${a.worst.name} (${a.worst.average}%).` : ""),
      14,
      y,
      { maxWidth: 269 }
    );

    y += 10;
    const bw = 63;
    statBox(doc, 14, y, bw, "Learners", String(a.students.length));
    statBox(doc, 14 + bw + 5, y, bw, "Class Average", `${a.classAverage}%`);
    statBox(doc, 14 + (bw + 5) * 2, y, bw, "Pass Rate", `${a.passRate}%`);
    statBox(doc, 14 + (bw + 5) * 3, y, bw, "Passes / Fails", `${a.passCount} / ${a.failCount}`);

    y += 24;
    barChart(
      doc,
      14,
      y,
      130,
      48,
      "Grade Distribution",
      a.gradeDistribution.map((g) => ({ name: g.name, value: g.count })),
      NAVY
    );
    barChart(
      doc,
      153,
      y,
      130,
      48,
      "Subject Averages (%)",
      a.subjectAverages.slice(0, 8).map((s) => ({ name: s.name, value: s.average })),
      GOLD
    );

    y += 58;

    const head = ["#", "Reg No.", "Student", ...a.subjectNames, "Total", "Avg %", "Grade"];
    const body = a.students.map((s, i) => [
      s.position ? String(s.position) : String(i + 1),
      s.reg,
      s.name,
      ...a.subjectNames.map((n) => (typeof s.subjects[n] === "number" ? `${s.subjects[n]}` : "—")),
      s.count ? String(s.total) : "—",
      s.count ? `${s.average}` : "—",
      s.grade,
    ]);

    autoTable(doc, {
      startY: y,
      head: [head],
      body,
      theme: "grid",
      styles: { fontSize: 7.5, cellPadding: 1.5 },
      headStyles: { fillColor: NAVY, textColor: 255, fontSize: 7.5 },
      alternateRowStyles: { fillColor: [246, 247, 250] },
      margin: { left: 14, right: 14 },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === head.length - 1) {
          const g = String(data.cell.raw);
          if (g !== "—") {
            data.cell.styles.textColor = isPass(g) ? [21, 101, 192] : [200, 30, 30];
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
    });
  });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(130, 130, 140);
    doc.text(`Progress Christian College · Confidential · Page ${i} of ${pages}`, 148, 203, { align: "center" });
  }

  doc.save(`${docTitle.toLowerCase().replace(/\s+/g, "_")}.pdf`);
};

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface FeesByClassEntry {
  className: string;
  paid: { name: string; regNo: string; amount: number }[];
  unpaid: { name: string; regNo: string }[];
}

export const generateFeesByClassPDF = (groups: FeesByClassEntry[]) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const navy: [number, number, number] = [0, 51, 102];

  doc.setFillColor(...navy);
  doc.rect(0, 0, 210, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Fees Status by Class", 14, 12);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(new Date().toLocaleString(), 196, 12, { align: "right" });

  let y = 26;
  doc.setTextColor(0, 0, 0);

  groups.forEach((g) => {
    const total = g.paid.length + g.unpaid.length;
    const pct = total ? Math.round((g.paid.length / total) * 100) : 0;

    if (y > 260) { doc.addPage(); y = 20; }

    doc.setFillColor(240, 240, 245);
    doc.rect(10, y - 5, 190, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...navy);
    doc.text(g.className, 12, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(
      `Total: ${total}  •  Paid: ${g.paid.length}  •  Unpaid: ${g.unpaid.length}  •  ${pct}%`,
      198,
      y,
      { align: "right" }
    );
    y += 5;

    autoTable(doc, {
      startY: y,
      head: [["#", "PAID — Name", "Reg No.", "Amount ($)"]],
      body: g.paid.length
        ? g.paid.map((s, i) => [i + 1, s.name, s.regNo, s.amount.toFixed(2)])
        : [["—", "No paid students", "", ""]],
      theme: "grid",
      headStyles: { fillColor: [34, 139, 87], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 10, right: 10 },
    });
    y = (doc as any).lastAutoTable.finalY + 3;

    autoTable(doc, {
      startY: y,
      head: [["#", "NOT PAID — Name", "Reg No."]],
      body: g.unpaid.length
        ? g.unpaid.map((s, i) => [i + 1, s.name, s.regNo])
        : [["—", "All paid", ""]],
      theme: "grid",
      headStyles: { fillColor: [180, 40, 40], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 10, right: 10 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  });

  doc.save(`fees-by-class-${new Date().toISOString().slice(0, 10)}.pdf`);
};

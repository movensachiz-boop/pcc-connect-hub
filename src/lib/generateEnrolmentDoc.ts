import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface EnrolmentFeeRow {
  label: string;
  amount: string;
}

export interface EnrolmentUniformRow {
  name: string;
  qty: number;
  price: number;
}

export interface EnrolmentDocData {
  year: string;
  campus: string;
  levelLabel: string;      // e.g. "Commercials and Arts (L6&U6)"
  uniformHeading: string;  // e.g. "Girls Form 1- 4"
  fees: EnrolmentFeeRow[];
  books: string[];
  uniforms: EnrolmentUniformRow[];
  footNote?: string;
}

const NAVY: [number, number, number] = [16, 42, 94];
const HEAD_BG: [number, number, number] = [26, 58, 122];
const ROW_ALT: [number, number, number] = [238, 242, 249];

const money = (n: number) => `$${n.toFixed(2)}`;

export const buildEnrolmentDoc = async (data: EnrolmentDocData): Promise<jsPDF> => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = 210;
  const margin = 14;
  let y = 12;

  // Logo
  try {
    const logoModule = await import("@/assets/pcc-logo.png");
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject();
      img.src = logoModule.default;
    });
    doc.addImage(img, "PNG", pw / 2 - 13, y, 26, 26);
    y += 30;
  } catch {
    y += 6;
  }

  // Navy banner
  const bannerH = 26;
  doc.setFillColor(...NAVY);
  doc.rect(0, y, pw, bannerH, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("PROGRESS  CENTRE COLLEGE", pw / 2, y + 9, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("11729 Mkoba 14, Gweru  |  +263 77 400 0143", pw / 2, y + 16, { align: "center" });
  doc.setFontSize(11);
  doc.setTextColor(255, 214, 0);
  doc.text(`ENROLMENT REQUIREMENTS — ${data.year}`, pw / 2, y + 23, { align: "center" });
  y += bannerH + 10;

  // Sub title
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.text(
    `Progress Centre College Enrolment Requirements for ${data.campus}`,
    pw / 2,
    y,
    { align: "center" }
  );
  y += 7;

  // Fees + Books table
  const feeRows = Math.max(data.fees.length, data.books.length);
  const feeBody: string[][] = [];
  for (let i = 0; i < feeRows; i++) {
    feeBody.push([
      data.fees[i]?.label ?? "",
      data.fees[i]?.amount ?? "",
      data.books[i] ?? "",
    ]);
  }

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Item", data.levelLabel, "Books"]],
    body: feeBody,
    theme: "grid",
    headStyles: { fillColor: HEAD_BG, textColor: 255, fontStyle: "bold", fontSize: 9.5 },
    bodyStyles: { fontSize: 9, textColor: [40, 40, 40], cellPadding: 2.2 },
    alternateRowStyles: { fillColor: ROW_ALT },
    styles: { lineColor: [200, 208, 220], lineWidth: 0.2 },
    columnStyles: {
      0: { cellWidth: (pw - 2 * margin) * 0.34 },
      1: { cellWidth: (pw - 2 * margin) * 0.33 },
      2: { cellWidth: (pw - 2 * margin) * 0.33 },
    },
  });
  // @ts-ignore
  y = doc.lastAutoTable.finalY + 10;

  // Uniform heading
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...NAVY);
  doc.text(`Uniform Requirements for  ${data.uniformHeading}`, margin, y);
  y += 4;

  const uniformTotal = data.uniforms.reduce((s, u) => s + u.qty * u.price, 0);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Uniform", "Quantity", "Price / item", "Total Price"]],
    body: [
      ...data.uniforms.map((u) => [u.name, String(u.qty), money(u.price), money(u.qty * u.price)]),
      ["Total", "", "", money(uniformTotal)],
    ],
    theme: "grid",
    headStyles: { fillColor: HEAD_BG, textColor: 255, fontStyle: "bold", fontSize: 9.5 },
    bodyStyles: { fontSize: 9, textColor: [40, 40, 40], cellPadding: 2 },
    alternateRowStyles: { fillColor: ROW_ALT },
    styles: { lineColor: [200, 208, 220], lineWidth: 0.2 },
    columnStyles: {
      0: { cellWidth: (pw - 2 * margin) * 0.46 },
      1: { cellWidth: (pw - 2 * margin) * 0.14, halign: "center" },
      2: { cellWidth: (pw - 2 * margin) * 0.2, halign: "right" },
      3: { cellWidth: (pw - 2 * margin) * 0.2, halign: "right" },
    },
    didParseCell: (hook) => {
      if (hook.section === "body" && hook.row.index === data.uniforms.length) {
        hook.cell.styles.fontStyle = "bold";
        hook.cell.styles.fillColor = [255, 255, 255];
        hook.cell.styles.textColor = NAVY;
      }
    },
  });
  // @ts-ignore
  y = doc.lastAutoTable.finalY + 8;

  if (data.footNote) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(90, 90, 90);
    const lines = doc.splitTextToSize(data.footNote, pw - 2 * margin) as string[];
    lines.forEach((l) => {
      doc.text(l, margin, y);
      y += 4.2;
    });
  }

  return doc;
};

export const enrolmentDocFileName = (data: EnrolmentDocData) =>
  `Enrolment_Requirements_${data.campus}_${data.uniformHeading}_${data.year}`
    .replace(/[^a-zA-Z0-9]+/g, "_") + ".pdf";

export const downloadEnrolmentDoc = async (data: EnrolmentDocData) => {
  const doc = await buildEnrolmentDoc(data);
  doc.save(enrolmentDocFileName(data));
};

export const printEnrolmentDoc = async (data: EnrolmentDocData) => {
  const doc = await buildEnrolmentDoc(data);
  doc.autoPrint();
  const url = URL.createObjectURL(doc.output("blob"));
  const w = window.open(url, "_blank");
  if (!w) {
    URL.revokeObjectURL(url);
    doc.save(enrolmentDocFileName(data));
    return;
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
};

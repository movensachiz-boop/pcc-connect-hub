import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface ReceiptData {
  receiptNo: string;
  studentName: string;
  regNo: string;
  date: string;
  amount: string;
  method: string;
  description?: string;
}

export const generateReceipt = async (data: ReceiptData) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const pw = 210;
  const margin = 20;
  const primary: [number, number, number] = [0, 51, 102];
  const blue: [number, number, number] = [41, 128, 185];
  let y = 15;

  // ── Logo centered at top ──
  try {
    const logoModule = await import("@/assets/pcc-logo.png");
    const logoUrl = logoModule.default;
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject();
      img.src = logoUrl;
    });
    doc.addImage(img, "JPEG", pw / 2 - 12, y, 24, 24);
    y += 28;
  } catch {
    y += 5;
  }

  // ── Blue contact bar ──
  doc.setFillColor(...blue);
  doc.rect(0, y, pw, 10, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text("PROGRESS CHRISTIAN CENTRE  |  info@pcc.ac.zw  |  +263 XXX XXX XXX", pw / 2, y + 6.5, { align: "center" });
  y += 18;

  // ── Title ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(30, 30, 30);
  doc.text("School Fees Receipt", pw / 2, y, { align: "center" });
  y += 12;

  // ── Invoice & Student Details (two-column table) ──
  const midX = margin + (pw - 2 * margin) / 2;
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: pw - 2 * margin,
    head: [["Receipt Details", "Student Information"]],
    body: [
      [`Receipt No.: ${data.receiptNo}`, `Student Name: ${data.studentName}`],
      [`Receipt Date: ${data.date}`, `Reg. Number: ${data.regNo}`],
      [`Payment Method: ${data.method}`, `Status: PAID`],
    ],
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [...blue],
      fontStyle: "italic",
      fontSize: 10,
      lineWidth: 0,
    },
    bodyStyles: {
      fontSize: 9.5,
      textColor: [30, 30, 30],
      cellPadding: 4,
    },
    columnStyles: {
      0: { cellWidth: (pw - 2 * margin) / 2 },
      1: { cellWidth: (pw - 2 * margin) / 2, fontStyle: "bold" },
    },
    theme: "grid",
    styles: {
      lineColor: [200, 200, 200],
      lineWidth: 0.3,
    },
  });

  // @ts-ignore
  y = doc.lastAutoTable.finalY + 10;

  // ── Services breakdown table ──
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: pw - 2 * margin,
    head: [["Description of Services", "Subtotal"]],
    body: [
      ["Tuition Fee", data.amount],
    ],
    foot: [
      [{ content: "Total Amount Paid", styles: { fontStyle: "bold" } }, { content: data.amount, styles: { fontStyle: "bold", fontSize: 12 } }],
    ],
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [...blue],
      fontStyle: "italic",
      fontSize: 10,
      lineWidth: 0,
    },
    bodyStyles: {
      fontSize: 10,
      textColor: [30, 30, 30],
      cellPadding: 5,
    },
    footStyles: {
      fillColor: [240, 245, 250],
      textColor: [...primary],
      fontSize: 10,
    },
    columnStyles: {
      0: { cellWidth: (pw - 2 * margin) * 0.65 },
      1: { cellWidth: (pw - 2 * margin) * 0.35, halign: "right" },
    },
    theme: "grid",
    styles: {
      lineColor: [200, 200, 200],
      lineWidth: 0.3,
    },
  });

  // @ts-ignore
  y = doc.lastAutoTable.finalY + 12;

  // ── Payment Information ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.text("Payment Information:", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(`Payment was received via ${data.method}. Please retain this receipt for your records.`, margin, y);
  y += 12;

  // ── Terms and Conditions ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.text("Terms and Conditions:", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text("Fees are due at the beginning of each term. Late payments may incur additional charges.", margin, y);
  y += 5;
  doc.text("For any questions, please contact the school bursar at Progress Christian Centre.", margin, y);
  y += 15;

  // ── Signature line ──
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + 60, y);
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text("Authorized Signature", margin + 30, y + 5, { align: "center" });

  // ── PAID stamp ──
  doc.setDrawColor(...blue);
  doc.setLineWidth(1.5);
  doc.circle(pw - margin - 20, y - 5, 14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...blue);
  doc.text("PAID", pw - margin - 20, y - 6, { align: "center" });
  doc.setFontSize(6);
  doc.text("VERIFIED", pw - margin - 20, y, { align: "center" });

  // ── Footer ──
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text("This is a computer-generated receipt from Progress Christian Centre.", pw / 2, 285, { align: "center" });

  doc.save(`Receipt_${data.receiptNo}.pdf`);
};

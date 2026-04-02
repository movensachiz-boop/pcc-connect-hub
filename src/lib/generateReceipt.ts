import { jsPDF } from "jspdf";

interface ReceiptData {
  receiptNo: string;
  studentName: string;
  regNo: string;
  date: string;
  amount: string;
  method: string;
  description?: string;
}

export const generateReceipt = (data: ReceiptData) => {
  const doc = new jsPDF({ unit: "mm", format: [210, 148] }); // A5 landscape-ish

  const pw = 210;
  const primary = [0, 51, 102] as [number, number, number];
  const gold = [196, 164, 105] as [number, number, number];

  // Border
  doc.setDrawColor(...primary);
  doc.setLineWidth(1.5);
  doc.rect(5, 5, pw - 10, 138);
  doc.setDrawColor(...gold);
  doc.setLineWidth(0.5);
  doc.rect(7, 7, pw - 14, 134);

  // Header background
  doc.setFillColor(...primary);
  doc.rect(7, 7, pw - 14, 28, "F");

  // School name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text("Progress Christian Centre", pw / 2, 18, { align: "center" });

  doc.setFontSize(11);
  doc.setTextColor(...gold);
  doc.text("OFFICIAL PAYMENT RECEIPT", pw / 2, 28, { align: "center" });

  // Gold line
  doc.setDrawColor(...gold);
  doc.setLineWidth(0.8);
  doc.line(20, 38, pw - 20, 38);

  // Receipt info row
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(`Receipt No: ${data.receiptNo}`, 15, 46);
  doc.text(`Date: ${data.date}`, pw - 15, 46, { align: "right" });

  // Details table
  const startY = 55;
  const labelX = 20;
  const valueX = 75;
  const rows = [
    ["Student Name", data.studentName],
    ["Reg. Number", data.regNo],
    ["Amount Paid", data.amount],
    ["Payment Method", data.method],
    ["Description", data.description || "School Fees"],
  ];

  rows.forEach(([label, value], i) => {
    const y = startY + i * 12;
    // Zebra stripe
    if (i % 2 === 0) {
      doc.setFillColor(245, 245, 250);
      doc.rect(15, y - 5, pw - 30, 12, "F");
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...primary);
    doc.text(label, labelX, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 51, 51);
    doc.text(value, valueX, y);
  });

  // Stamp area
  const stampY = startY + rows.length * 12 + 8;
  doc.setDrawColor(...gold);
  doc.setLineWidth(1);
  doc.circle(pw - 40, stampY + 5, 12);
  doc.setFontSize(7);
  doc.setTextColor(...gold);
  doc.setFont("helvetica", "bold");
  doc.text("PAID", pw - 40, stampY + 4, { align: "center" });
  doc.setFontSize(5);
  doc.text("VERIFIED", pw - 40, stampY + 8, { align: "center" });

  // Signature line
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(20, stampY + 10, 80, stampY + 10);
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text("Authorized Signature", 50, stampY + 15, { align: "center" });

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text("This is a computer-generated receipt. No signature required for amounts below $500.", pw / 2, 136, { align: "center" });

  doc.save(`Receipt_${data.receiptNo}.pdf`);
};

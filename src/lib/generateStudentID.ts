import { jsPDF } from "jspdf";

interface StudentIDData {
  name: string;
  regNumber: string;
  form: string;
  stream: string;
  year: string;
}

export const generateStudentID = async (student: StudentIDData) => {
  // Card size: 86mm x 54mm (standard credit card)
  const doc = new jsPDF({ unit: "mm", format: [86, 54] });

  const cw = 86;
  const ch = 54;
  const primary: [number, number, number] = [0, 51, 102];
  const blue: [number, number, number] = [41, 128, 185];
  const gold: [number, number, number] = [196, 164, 105];

  // Background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, cw, ch, "F");

  // Top navy band
  doc.setFillColor(...primary);
  doc.rect(0, 0, cw, 18, "F");

  // Gold accent line
  doc.setFillColor(...gold);
  doc.rect(0, 18, cw, 1.5, "F");

  // Logo
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
    doc.addImage(img, "JPEG", 3, 2, 14, 14);
  } catch {
    // continue without logo
  }

  // School name in header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text("PROGRESS CHRISTIAN", 50, 7, { align: "center" });
  doc.text("CENTRE", 50, 12, { align: "center" });

  doc.setFontSize(5.5);
  doc.setTextColor(...gold);
  doc.text("STUDENT IDENTIFICATION CARD", 50, 16.5, { align: "center" });

  // Photo placeholder
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(240, 240, 245);
  doc.roundedRect(5, 22, 18, 22, 1, 1, "FD");
  doc.setFontSize(5);
  doc.setTextColor(160, 160, 160);
  doc.text("PHOTO", 14, 34, { align: "center" });

  // Student details
  const detailX = 27;
  let y = 24;

  const addField = (label: string, value: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.setTextColor(120, 120, 120);
    doc.text(label, detailX, y);
    y += 3.5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(30, 30, 30);
    doc.text(value, detailX, y);
    y += 5;
  };

  addField("FULL NAME", student.name);
  addField("REG NUMBER", student.regNumber);
  addField("CLASS / STREAM", `Form ${student.form} - ${student.stream}`);

  // Year badge
  doc.setFillColor(...blue);
  doc.roundedRect(65, 38, 17, 7, 1, 1, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(student.year, 73.5, 43, { align: "center" });

  // Bottom bar
  doc.setFillColor(...primary);
  doc.rect(0, ch - 4, cw, 4, "F");
  doc.setFontSize(4.5);
  doc.setTextColor(200, 200, 210);
  doc.text("This card is the property of Progress Christian Centre", cw / 2, ch - 1.2, { align: "center" });

  doc.save(`StudentID_${student.regNumber}.pdf`);
};

export const generateBulkStudentIDs = async (students: StudentIDData[]) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const cardW = 86;
  const cardH = 54;
  const marginX = 12;
  const marginY = 15;
  const gapX = 10;
  const gapY = 8;
  const cols = 2;
  const rowsPerPage = 4;

  const primary: [number, number, number] = [0, 51, 102];
  const blue: [number, number, number] = [41, 128, 185];
  const gold: [number, number, number] = [196, 164, 105];

  let logoImg: HTMLImageElement | null = null;
  try {
    const logoModule = await import("@/assets/pcc-logo.png");
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject();
      img.src = logoModule.default;
    });
    logoImg = img;
  } catch {
    // continue without logo
  }

  for (let i = 0; i < students.length; i++) {
    const pageIndex = Math.floor(i / (cols * rowsPerPage));
    const posOnPage = i % (cols * rowsPerPage);
    const col = posOnPage % cols;
    const row = Math.floor(posOnPage / cols);

    if (i > 0 && posOnPage === 0) doc.addPage();

    const x = marginX + col * (cardW + gapX);
    const y = marginY + row * (cardH + gapY);

    const s = students[i];

    // Card border
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, cardW, cardH, 2, 2, "S");

    // Top navy band
    doc.setFillColor(...primary);
    doc.rect(x, y, cardW, 18, "F");

    // Gold line
    doc.setFillColor(...gold);
    doc.rect(x, y + 18, cardW, 1.5, "F");

    // Logo
    if (logoImg) {
      doc.addImage(logoImg, "JPEG", x + 3, y + 2, 14, 14);
    }

    // School name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text("PROGRESS CHRISTIAN", x + cardW / 2 + 5, y + 7, { align: "center" });
    doc.text("CENTRE", x + cardW / 2 + 5, y + 12, { align: "center" });
    doc.setFontSize(5.5);
    doc.setTextColor(...gold);
    doc.text("STUDENT IDENTIFICATION CARD", x + cardW / 2 + 5, y + 16.5, { align: "center" });

    // Photo placeholder
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(240, 240, 245);
    doc.roundedRect(x + 5, y + 22, 18, 22, 1, 1, "FD");
    doc.setFontSize(5);
    doc.setTextColor(160, 160, 160);
    doc.text("PHOTO", x + 14, y + 34, { align: "center" });

    // Details
    const dx = x + 27;
    let dy = y + 24;

    const addField = (label: string, value: string) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.5);
      doc.setTextColor(120, 120, 120);
      doc.text(label, dx, dy);
      dy += 3.5;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(30, 30, 30);
      doc.text(value, dx, dy);
      dy += 5;
    };

    addField("FULL NAME", s.name);
    addField("REG NUMBER", s.regNumber);
    addField("CLASS / STREAM", `Form ${s.form} - ${s.stream}`);

    // Year badge
    doc.setFillColor(...blue);
    doc.roundedRect(x + 65, y + 38, 17, 7, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text(s.year, x + 73.5, y + 43, { align: "center" });

    // Bottom bar
    doc.setFillColor(...primary);
    doc.rect(x, y + cardH - 4, cardW, 4, "F");
    doc.setFontSize(4.5);
    doc.setTextColor(200, 200, 210);
    doc.text("Property of Progress Christian Centre", x + cardW / 2, y + cardH - 1.2, { align: "center" });
  }

  doc.save(`Student_IDs_${new Date().getFullYear()}.pdf`);
};

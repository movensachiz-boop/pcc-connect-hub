import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { DEFAULT_PRICING, DEFAULT_PROVIDER, DEFAULT_SECTIONS, SECTION_ORDER } from "./slaDefaults";
import stampAsset from "@/assets/dataplex-stamp.png.asset.json";

/**
 * Loads the company stamp and processes it so it prints like a real rubber
 * stamp: white background knocked out, ink slightly uneven/faded, edges broken.
 */
export const loadStampDataUrl = async (): Promise<string | null> => {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = "anonymous";
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = stampAsset.url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;
    const w = canvas.width;

    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const lum = (r + g + b) / 3;

      // Knock out the white paper background
      if (lum > 215) {
        d[i + 3] = 0;
        continue;
      }

      // Soft edge falloff for anti-aliased pixels
      let alpha = lum > 170 ? Math.round(255 * (1 - (lum - 170) / 45)) : 255;

      const px = (i / 4) % w;
      const py = Math.floor(i / 4 / w);

      // Uneven ink coverage: low-frequency wave + high-frequency speckle
      const wave =
        Math.sin(px * 0.013) * Math.cos(py * 0.017) +
        Math.sin((px + py) * 0.031) * 0.6;
      const speckle = Math.random();

      alpha *= 0.72 + wave * 0.12;
      if (speckle > 0.90) alpha *= 0.25; // dry-ink pinholes
      if (speckle < 0.03) alpha *= 1.15; // ink pooling

      d[i + 3] = Math.max(0, Math.min(255, alpha));

      // Slightly bleed / desaturate the ink so it reads as pigment, not vector
      d[i] = Math.min(255, r + 18);
      d[i + 1] = Math.min(255, g + 10);
      d[i + 2] = Math.min(255, b + 24);
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
};


export interface SlaAgreementData {
  agreement_number: string;
  status?: string;
  client_name: string;
  contact_person?: string | null;
  school_name?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  start_date?: string | null;
  expiry_date?: string | null;
  renewal_date?: string | null;
  monthly_fee: number;
  currency: string;
  provider: Partial<typeof DEFAULT_PROVIDER> & Record<string, any>;
  pricing: Partial<typeof DEFAULT_PRICING> & Record<string, any>;
  sections: Record<string, string>;
  student_count?: number;
}

const RESPONSE_TABLE = [
  ["Critical", "Complete system failure", "30 Minutes", "Within 4 Hours"],
  ["High", "Major function unavailable", "1 Hour", "Within 8 Hours"],
  ["Medium", "Operational issue affecting some users", "4 Hours", "Within 24 Hours"],
  ["Low", "Minor bug or cosmetic issue", "1 Business Day", "Within 5 Business Days"],
];

export const generateSLA = async (data: SlaAgreementData) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const margin = 18;
  const primary: [number, number, number] = [0, 51, 102];

  const provider = { ...DEFAULT_PROVIDER, ...(data.provider || {}) };
  const pricing = { ...DEFAULT_PRICING, ...(data.pricing || {}) };
  const sections = { ...DEFAULT_SECTIONS, ...(data.sections || {}) };

  let y = margin;

  const ensureSpace = (need: number) => {
    if (y + need > ph - margin - 12) {
      doc.addPage();
      y = margin;
    }
  };

  // Watermark on every page (added at end)
  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...primary);
  doc.text("SERVICE LEVEL AGREEMENT", pw / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);
  doc.text(`Agreement No: ${data.agreement_number}`, pw / 2, y, { align: "center" });
  y += 5;
  doc.text(`Generated: ${new Date().toLocaleString()}`, pw / 2, y, { align: "center" });
  y += 8;

  doc.setDrawColor(...primary);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pw - margin, y);
  y += 8;

  // Parties
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("BETWEEN", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`${provider.name}  (${provider.business_type})`, margin, y); y += 5;
  if (provider.address) { doc.text(`Address: ${provider.address}`, margin, y); y += 5; }
  if (provider.phone) { doc.text(`Phone: ${provider.phone}`, margin, y); y += 5; }
  if (provider.email) { doc.text(`Email: ${provider.email}`, margin, y); y += 5; }
  y += 2;

  doc.setFont("helvetica", "bold");
  doc.text("AND", margin, y); y += 6;
  doc.setFont("helvetica", "normal");
  doc.text(data.client_name || data.school_name || "Client", margin, y); y += 5;
  if (data.address) { doc.text(`Address: ${data.address}`, margin, y); y += 5; }
  if (data.contact_person) { doc.text(`Represented by: ${data.contact_person}`, margin, y); y += 5; }
  if (data.phone) { doc.text(`Phone: ${data.phone}`, margin, y); y += 5; }
  if (data.email) { doc.text(`Email: ${data.email}`, margin, y); y += 5; }
  y += 2;

  doc.setFont("helvetica", "bold");
  doc.text(`Effective Date: `, margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(data.start_date || "________________", margin + 32, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.text(`Expiry Date: `, margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(data.expiry_date || "________________", margin + 32, y);
  y += 8;

  const writeSection = (title: string, body: string) => {
    ensureSpace(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...primary);
    doc.text(title, margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(30);
    const lines = doc.splitTextToSize(body, pw - margin * 2);
    lines.forEach((ln: string) => {
      ensureSpace(5);
      doc.text(ln, margin, y);
      y += 5;
    });
    y += 3;
  };

  const drawReceiptPreview = (kind: "fees" | "inventory") => {
    doc.addPage();
    y = margin;
    const title = kind === "fees" ? "APPENDIX A — FEES RECEIPT EXAMPLE" : "APPENDIX B — INVENTORY RECEIPT EXAMPLE";
    const receiptTitle = kind === "fees" ? "Fees Receipt" : "Inventory Sale Receipt";
    const receiptNo = kind === "fees" ? "PCC-2026-001245" : "INV-2026-000318";

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...primary);
    doc.text(title, margin, y);
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60);
    doc.text("The example below shows the actual information hierarchy and printed appearance produced by the system.", margin, y);
    y += 9;

    const rx = 24;
    const rw = pw - 48;
    const ry = y;
    doc.setDrawColor(41, 128, 185);
    doc.setLineWidth(0.8);
    doc.rect(rx, ry, rw, 226);
    doc.setLineWidth(0.25);
    doc.rect(rx + 2, ry + 2, rw - 4, 222);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...primary);
    doc.text("PROGRESS CHRISTIAN CENTRE", pw / 2, ry + 13, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(80);
    doc.text("11729 Mkoba 14, Gweru, Zimbabwe  |  +263 77 400 0143", pw / 2, ry + 18, { align: "center" });
    doc.setFillColor(41, 128, 185);
    doc.rect(rx + 2, ry + 23, rw - 4, 9, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30);
    doc.text(receiptTitle, pw / 2, ry + 43, { align: "center" });

    if (kind === "fees") {
      doc.setFillColor(255, 215, 0);
      doc.setDrawColor(...primary);
      doc.roundedRect(pw / 2 - 31, ry + 47, 62, 8, 1.5, 1.5, "FD");
      doc.setFontSize(9);
      doc.setTextColor(...primary);
      doc.text("TERM 2 2026", pw / 2, ry + 52.5, { align: "center" });
    }

    autoTable(doc, {
      startY: ry + 61,
      margin: { left: rx + 9, right: rx + 9 },
      head: [["Receipt Details", "Student Information"]],
      body: [
        [`Receipt No.: ${receiptNo}`, "Student Name: SAMPLE STUDENT"],
        ["Receipt Date: 17 September 2026", "Reg. Number: PC1047"],
        [kind === "fees" ? "Payment Method: EcoCash" : "Payment Method: Swipe", "Class: Form 5 Commercials"],
        ["Status: PAID", kind === "fees" ? "Term: Term 2 2026" : "Purchase: School Inventory"],
      ],
      headStyles: { fillColor: [255, 255, 255], textColor: [41, 128, 185], fontStyle: "italic", fontSize: 8.5 },
      bodyStyles: { fontSize: 8, cellPadding: 3 },
      theme: "grid",
      styles: { lineColor: [200, 200, 200], lineWidth: 0.25 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    const rows = kind === "fees"
      ? [["Tuition Fee — Term 2 2026", "1", "USD $270.00", "USD $270.00"]]
      : [["School Jersey", "1", "USD $25.00", "USD $25.00"], ["Exercise Books", "10", "USD $1.00", "USD $10.00"]];
    const totalAmount = kind === "fees" ? "USD $270.00" : "USD $35.00";
    autoTable(doc, {
      startY: y,
      margin: { left: rx + 9, right: rx + 9 },
      head: [["Description", "Qty", "Unit Price", "Subtotal"]],
      body: rows,
      foot: [[{ content: "TOTAL AMOUNT PAID", colSpan: 3, styles: { halign: "right", fontStyle: "bold" } }, totalAmount]],
      headStyles: { fillColor: primary, textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8, cellPadding: 3 },
      footStyles: { fillColor: [240, 245, 250], textColor: primary, fontStyle: "bold" },
      columnStyles: { 1: { halign: "center", cellWidth: 14 }, 2: { halign: "right", cellWidth: 30 }, 3: { halign: "right", cellWidth: 32 } },
      theme: "grid",
      styles: { lineColor: [200, 200, 200], lineWidth: 0.25 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    doc.setFillColor(245, 248, 252);
    doc.setDrawColor(41, 128, 185);
    doc.roundedRect(rx + 9, y, rw - 18, 38, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...primary);
    doc.text("SECURITY VERIFICATION", rx + 14, y + 7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(60);
    doc.text(`Receipt No: ${receiptNo}`, rx + 14, y + 14);
    doc.text("QR verification links the printed receipt to the cloud record.", rx + 14, y + 20);
    doc.text("Any duplicate or altered receipt can be checked against the original entry.", rx + 14, y + 26);
    doc.setDrawColor(40);
    doc.rect(rx + rw - 40, y + 6, 26, 26);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(40);
    doc.text("QR CODE", rx + rw - 27, y + 20, { align: "center" });
    y += 47;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(41, 128, 185);
    doc.text("PAID", pw - rx - 24, y, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100);
    doc.text("Computer-generated receipt • cashier and transaction details retained in the system", pw / 2, ry + 217, { align: "center" });
    y = ry + 226;
  };

  // Section 1-2
  writeSection(SECTION_ORDER[0].title, sections.purpose);
  writeSection(SECTION_ORDER[1].title, sections.scope);

  // Installations bullets
  ensureSpace(10);
  doc.setFont("helvetica", "bold");
  doc.text("Covered Installations:", margin, y); y += 5;
  doc.setFont("helvetica", "normal");
  (pricing.installations || []).filter((it: string) => it && it.trim()).forEach((it: string) => {
    ensureSpace(5);
    doc.text(`• ${it}`, margin + 4, y); y += 5;
  });
  y += 3;

  writeSection(SECTION_ORDER[2].title, sections.excluded);
  writeSection(SECTION_ORDER[3].title, sections.availability);
  writeSection(SECTION_ORDER[4].title, sections.support_hours);

  // Response times table
  ensureSpace(14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...primary);
  doc.text(SECTION_ORDER[5].title, margin, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    head: [["Priority", "Description", "Response Time", "Resolution Target"]],
    body: RESPONSE_TABLE,
    theme: "grid",
    headStyles: { fillColor: primary, textColor: 255 },
    styles: { fontSize: 9, cellPadding: 2 },
    margin: { left: margin, right: margin },
  });
  // @ts-ignore
  y = (doc as any).lastAutoTable.finalY + 6;

  writeSection(SECTION_ORDER[6].title, sections.provider_resp);
  writeSection(SECTION_ORDER[7].title, sections.school_resp);
  writeSection(SECTION_ORDER[8].title, sections.data_ownership);

  writeSection(SECTION_ORDER[9].title, sections.banking_integration);
  ensureSpace(18);
  doc.setFillColor(240, 245, 250);
  doc.setDrawColor(...primary);
  doc.roundedRect(margin, y, pw - margin * 2, 14, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...primary);
  doc.text("LIVE REGISTERED STUDENTS", margin + 5, y + 6);
  doc.setFontSize(14);
  doc.text(String(data.student_count ?? 0), pw - margin - 5, y + 9, { align: "right" });
  y += 20;
  writeSection(SECTION_ORDER[10].title, sections.registration_numbers);

  // Fees with table
  ensureSpace(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...primary);
  doc.text(SECTION_ORDER[11].title, margin, y); y += 4;
  autoTable(doc, {
    startY: y,
    head: [["Item", "Amount"]],
    body: [
      [`Monthly Support & Maintenance Fee`, `${data.currency} $${Number(data.monthly_fee).toFixed(2)}`],
    ],
    theme: "grid",
    headStyles: { fillColor: primary, textColor: 255 },
    styles: { fontSize: 10, cellPadding: 3 },
    margin: { left: margin, right: margin },
  });
  // @ts-ignore
  y = (doc as any).lastAutoTable.finalY + 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(30);
  const feeLines = doc.splitTextToSize(sections.fees, pw - margin * 2);
  feeLines.forEach((ln: string) => { ensureSpace(5); doc.text(ln, margin, y); y += 5; });
  ensureSpace(6);
  doc.setFont("helvetica", "italic");
  doc.text(pricing.notice || "", margin, y);
  doc.setFont("helvetica", "normal");
  y += 8;

  writeSection(SECTION_ORDER[12].title, sections.confidentiality);
  writeSection(SECTION_ORDER[13].title, sections.termination);
  writeSection(SECTION_ORDER[14].title, sections.liability);

  drawReceiptPreview("fees");
  drawReceiptPreview("inventory");

  // Acceptance + signatures
  ensureSpace(95);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...primary);
  doc.text(SECTION_ORDER[15].title, margin, y); y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(30);
  doc.text(sections.acceptance, margin, y); y += 10;

  // signature blocks
  const colW = (pw - margin * 2 - 10) / 2;
  const blockY = y;
  const drawBlock = (x: number, title: string, name: string) => {
    doc.setFont("helvetica", "bold");
    doc.text(title, x, blockY);
    doc.setFont("helvetica", "normal");
    doc.text(`Name: ${name || "________________________"}`, x, blockY + 8);
    doc.text(`Signature: ________________________`, x, blockY + 16);
    doc.text(`Date: ____________________________`, x, blockY + 24);
  };
  drawBlock(margin, "Service Provider", provider.name);
  drawBlock(margin + colW + 10, "Client", data.contact_person || data.client_name);
  y = blockY + 32;

  // Company rubber stamp over the provider signature block
  const stamp = await loadStampDataUrl();
  if (stamp) {
    const sw = 52;
    const sh = 52 * (1240 / 1256);
    const sx = margin + 6;
    const sy = blockY - 4;
    doc.saveGraphicsState();
    // @ts-ignore
    doc.setGState(new (doc as any).GState({ opacity: 0.82 }));
    doc.addImage(stamp, "PNG", sx, sy, sw, sh, `stamp-${data.agreement_number}`, "NONE", -13);
    doc.restoreGraphicsState();
  }


  // Watermark + page numbers on every page
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    // diagonal watermark
    doc.saveGraphicsState();
    // @ts-ignore
    doc.setGState(new (doc as any).GState({ opacity: 0.08 }));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(48);
    doc.setTextColor(0, 51, 102);
    doc.text("DEVELOPER PORTAL", pw / 2, ph / 2, { align: "center", angle: 30 });
    doc.restoreGraphicsState();

    // footer
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      `Generated by Developer Portal  •  ${data.agreement_number}`,
      margin, ph - 8
    );
    doc.text(`Page ${i} of ${total}`, pw - margin, ph - 8, { align: "right" });
  }

  doc.save(`SLA_${data.agreement_number}.pdf`);
};

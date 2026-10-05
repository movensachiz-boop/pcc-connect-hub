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
  const rep = (data.contact_person || "").trim();
  const repValid = rep && !/whom it may concern/i.test(rep);
  doc.text(`Represented by: ${repValid ? rep : "______________________________"}`, margin, y); y += 5;
  doc.text(`Position: ______________________________`, margin, y); y += 5;
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

  const T = (key: string) => SECTION_ORDER.find(s => s.key === key)?.title || key;
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

  // Section 1-2
  writeSection(T("purpose"), sections.purpose);
  writeSection(T("scope"), sections.scope);

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

  writeSection(T("excluded"), sections.excluded);
  writeSection(T("availability"), sections.availability);
  writeSection(T("support_hours"), sections.support_hours);

  // Response times table
  ensureSpace(14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...primary);
  doc.text(T("response_times"), margin, y);
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

  writeSection(T("provider_resp"), sections.provider_resp);
  writeSection(T("school_resp"), sections.school_resp);
  writeSection(T("data_ownership"), sections.data_ownership);
  writeSection(T("software_ownership"), sections.software_ownership);
  writeSection(T("backup_recovery"), sections.backup_recovery);

  // Fees with table
  ensureSpace(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...primary);
  doc.text(T("fees"), margin, y); y += 4;
  const termlyFee = Number(pricing.termly_fee ?? data.monthly_fee ?? 90);
  const annualFee = Number(pricing.annual_fee ?? termlyFee * (pricing.terms_per_year ?? 3));
  const integrationFee = Number(pricing.integration_fee ?? 800);
  autoTable(doc, {
    startY: y,
    head: [["Item", "Amount"]],
    body: [
      [`Installation & Bank Integration (NBS) — Paid`, `${data.currency} $${integrationFee.toFixed(2)}`],
      [`System Maintenance Fee (per term)`, `${data.currency} $${termlyFee.toFixed(2)}`],
      [`System Maintenance Fee (per year, ${pricing.terms_per_year ?? 3} terms)`, `${data.currency} $${annualFee.toFixed(2)}`],
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
  y += 2;
  ensureSpace(10);
  doc.setFont("helvetica", "bold");
  doc.text("The maintenance fee covers:", margin, y); y += 5;
  doc.setFont("helvetica", "normal");
  (pricing.covers || []).filter((it: string) => it && it.trim()).forEach((it: string) => {
    ensureSpace(5);
    doc.text(`• ${it}`, margin + 4, y); y += 5;
  });
  ensureSpace(6);
  doc.setFont("helvetica", "italic");
  doc.text(pricing.notice || "", margin, y);
  doc.setFont("helvetica", "normal");
  y += 8;

  // Bank integration (one-off) with itemised cost breakdown
  ensureSpace(14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...primary);
  doc.text(T("bank_integration"), margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(30);
  const intLines = doc.splitTextToSize(sections.bank_integration || "", pw - margin * 2);
  intLines.forEach((ln: string) => { ensureSpace(5); doc.text(ln, margin, y); y += 5; });
  y += 2;
  ensureSpace(10);
  doc.setFont("helvetica", "bold");
  doc.text(`Breakdown of the ${data.currency} $${integrationFee.toFixed(2)} integration fee:`, margin, y); y += 5;
  doc.setFont("helvetica", "normal");
  (pricing.integration_costs || []).filter((it: string) => it && it.trim()).forEach((it: string) => {
    const itemLines = doc.splitTextToSize(`• ${it}`, pw - margin * 2 - 4);
    itemLines.forEach((ln: string) => {
      ensureSpace(5);
      doc.text(ln, margin + 4, y); y += 5;
    });
  });
  y += 3;

  writeSection(T("confidentiality"), sections.confidentiality);
  writeSection(T("termination"), sections.termination);
  writeSection(T("liability"), sections.liability);
  writeSection(T("force_majeure"), sections.force_majeure);
  writeSection(T("governing_law"), sections.governing_law);

  // Acceptance + signatures
  ensureSpace(130);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...primary);
  doc.text(T("acceptance"), margin, y); y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(30);
  doc.splitTextToSize(sections.acceptance, pw - margin * 2).forEach((ln: string) => { doc.text(ln, margin, y); y += 5; }); y += 5;

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
  drawBlock(margin + colW + 10, "Client", repValid ? rep : "");
  y = blockY + 36;
  const wY = y;
  const drawWitness = (x: number, title: string) => {
    doc.setFont("helvetica", "bold");
    doc.text(title, x, wY);
    doc.setFont("helvetica", "normal");
    doc.text(`Name: ________________________`, x, wY + 8);
    doc.text(`Signature: ________________________`, x, wY + 16);
    doc.text(`Date: ____________________________`, x, wY + 24);
  };
  drawWitness(margin, "Witness for Service Provider");
  drawWitness(margin + colW + 10, "Witness for Client");
  y = wY + 32;

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

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import schoolLogo from "@/assets/pcc-logo.png";
import { loadStampDataUrl } from "./generateSLA";

export interface BankProposalData {
  bankName: string;
  bankContact?: string;
  schoolName: string;
  schoolAddress: string;
  schoolPhone: string;
  studentCount: number;
  preparedBy: string;
}

const primary: [number, number, number] = [0, 51, 102];
const blue: [number, number, number] = [41, 128, 185];
const gold: [number, number, number] = [255, 215, 0];

export const generateBankProposal = async (data: BankProposalData) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const margin = 18;
  const generated = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  let y = margin;

  const addHeader = (section: string) => {
    doc.setFillColor(...primary);
    doc.rect(0, 0, pw, 18, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255);
    doc.text("DATAPLEX SOFTWARES", margin, 11);
    doc.setFont("helvetica", "normal");
    doc.text(section, pw - margin, 11, { align: "right" });
    y = 28;
  };

  const title = (value: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...primary);
    doc.text(value, margin, y);
    y += 8;
  };

  const paragraph = (value: string, gap = 5) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(35);
    const lines = doc.splitTextToSize(value, pw - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 4.7 + gap;
  };

  const bulletList = (items: string[]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.2);
    doc.setTextColor(35);
    items.forEach(item => {
      const lines = doc.splitTextToSize(item, pw - margin * 2 - 8);
      doc.setFillColor(...blue);
      doc.circle(margin + 1.5, y - 1.2, 0.8, "F");
      doc.text(lines, margin + 6, y);
      y += lines.length * 4.5 + 2;
    });
    y += 2;
  };

  const drawReceipt = async (kind: "fees" | "inventory") => {
    doc.addPage();
    addHeader(kind === "fees" ? "APPENDIX A — FEES RECEIPT" : "APPENDIX B — INVENTORY RECEIPT");
    const receiptTitle = kind === "fees" ? "Fees Receipt" : "Inventory Sale Receipt";
    const receiptNo = kind === "fees" ? "PCC-2026-001245" : "INV-2026-000318";
    const rx = 24;
    const rw = pw - 48;
    const ry = 38;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(65);
    doc.text("This specimen shows the information, controls and printed appearance available to customers and bank reviewers.", margin, 31);
    doc.setDrawColor(...blue);
    doc.setLineWidth(0.8);
    doc.rect(rx, ry, rw, 226);
    doc.setLineWidth(0.25);
    doc.rect(rx + 2, ry + 2, rw - 4, 222);

    try {
      const logo = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = schoolLogo;
      });
      doc.addImage(logo, "PNG", pw / 2 - 8, ry + 5, 16, 16);
    } catch { /* Text branding remains if the logo is unavailable. */ }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...primary);
    doc.text(data.schoolName.toUpperCase(), pw / 2, ry + 27, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(80);
    doc.text(`${data.schoolAddress}  |  ${data.schoolPhone}`, pw / 2, ry + 32, { align: "center" });
    doc.setFillColor(...blue);
    doc.rect(rx + 2, ry + 37, rw - 4, 9, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30);
    doc.text(receiptTitle, pw / 2, ry + 57, { align: "center" });

    if (kind === "fees") {
      doc.setFillColor(...gold);
      doc.setDrawColor(...primary);
      doc.roundedRect(pw / 2 - 31, ry + 61, 62, 8, 1.5, 1.5, "FD");
      doc.setFontSize(9);
      doc.setTextColor(...primary);
      doc.text("TERM 2 2026", pw / 2, ry + 66.5, { align: "center" });
    }

    autoTable(doc, {
      startY: ry + 75,
      margin: { left: rx + 9, right: rx + 9 },
      head: [["Receipt Details", "Student Information"]],
      body: [
        [`Receipt No.: ${receiptNo}`, "Student Name: SAMPLE STUDENT"],
        [`Receipt Date: ${generated}`, "Reg. Number: PC1047"],
        [kind === "fees" ? "Payment Method: Bank Transfer" : "Payment Method: Swipe", "Class: Form 5 Commercials"],
        ["Status: PAID", kind === "fees" ? "Term: Term 2 2026" : "Purchase: School Inventory"],
      ],
      headStyles: { fillColor: [255, 255, 255], textColor: blue, fontStyle: "italic", fontSize: 8.5 },
      bodyStyles: { fontSize: 8, cellPadding: 3 },
      theme: "grid",
      styles: { lineColor: [200, 200, 200], lineWidth: 0.25 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
    const rows = kind === "fees"
      ? [["Tuition Fee — Term 2 2026", "1", "USD $270.00", "USD $270.00"]]
      : [["School Jersey", "1", "USD $25.00", "USD $25.00"], ["Exercise Books", "10", "USD $1.00", "USD $10.00"]];
    autoTable(doc, {
      startY: y,
      margin: { left: rx + 9, right: rx + 9 },
      head: [["Description", "Qty", "Unit Price", "Subtotal"]],
      body: rows,
      foot: [[{ content: "TOTAL AMOUNT PAID", colSpan: 3, styles: { halign: "right", fontStyle: "bold" } }, kind === "fees" ? "USD $270.00" : "USD $35.00"]],
      headStyles: { fillColor: primary, textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8, cellPadding: 3 },
      footStyles: { fillColor: [240, 245, 250], textColor: primary, fontStyle: "bold" },
      columnStyles: { 1: { halign: "center", cellWidth: 14 }, 2: { halign: "right", cellWidth: 30 }, 3: { halign: "right", cellWidth: 32 } },
      theme: "grid",
      styles: { lineColor: [200, 200, 200], lineWidth: 0.25 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...blue);
    doc.text("PAID", pw - rx - 24, y - 3, { align: "center" });
    doc.setFillColor(245, 248, 252);
    doc.setDrawColor(...blue);
    doc.roundedRect(rx + 9, y, rw - 18, 38, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...primary);
    doc.text("SECURITY VERIFICATION", rx + 14, y + 7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(60);
    doc.text(`Receipt No: ${receiptNo}`, rx + 14, y + 14);
    doc.text("The QR code opens the original cloud payment record.", rx + 14, y + 20);
    doc.text("Bank reference, cashier and audit details remain attached to the transaction.", rx + 14, y + 26);
    try {
      const qr = await QRCode.toDataURL(`https://progresscentresys.com/verify?r=${encodeURIComponent(receiptNo)}`, { width: 180, margin: 1, errorCorrectionLevel: "M" });
      doc.addImage(qr, "PNG", rx + rw - 40, y + 6, 26, 26);
    } catch { /* The specimen remains usable without the QR image. */ }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100);
    doc.text("Computer-generated receipt • transaction and verification details retained in the system", pw / 2, ry + 217, { align: "center" });
  };

  // Cover
  doc.setFillColor(...primary);
  doc.rect(0, 0, pw, 78, "F");
  doc.setFillColor(...gold);
  doc.rect(0, 78, pw, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...gold);
  doc.text("DATAPLEX SOFTWARES", margin, 24);
  doc.setFontSize(24);
  doc.setTextColor(255);
  doc.text("BANKING INTEGRATION", margin, 44);
  doc.text("PROPOSAL", margin, 55);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("School fee collection, automated reconciliation and verified receipts", margin, 68);
  y = 104;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...primary);
  doc.text("PREPARED FOR", margin, y);
  y += 8;
  doc.setFontSize(20);
  doc.text(data.bankName || "BANKING PARTNER", margin, y);
  y += 8;
  if (data.bankContact) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(70);
    doc.text(`Attention: ${data.bankContact}`, margin, y);
    y += 7;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(70);
  doc.text(`School: ${data.schoolName}`, margin, y); y += 6;
  doc.text(`Registered learners: ${data.studentCount.toLocaleString()}`, margin, y); y += 6;
  doc.text(`Date: ${generated}`, margin, y);
  doc.setFillColor(240, 245, 250);
  doc.roundedRect(margin, 180, pw - margin * 2, 52, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...primary);
  doc.text("PURPOSE", margin + 8, 193);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(40);
  const coverPurpose = doc.splitTextToSize(
    `This proposal requests the technical, commercial and compliance support required from ${data.bankName || "the bank"} to connect the ${data.schoolName} finance system to live banking services. The objective is automatic payment identification, posting, reconciliation and receipt verification using each learner's permanent registration number.`,
    pw - margin * 2 - 16,
  );
  doc.text(coverPurpose, margin + 8, 202);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...primary);
  doc.text(`Prepared by: ${data.preparedBy}`, margin, 254);
  doc.text("CONFIDENTIAL — FOR BANK REVIEW", pw - margin, 254, { align: "right" });

  // Overview
  doc.addPage();
  addHeader("SOLUTION OVERVIEW");
  title("1. Executive Summary");
  paragraph(`${data.schoolName} operates a cloud-backed school management system serving ${data.studentCount.toLocaleString()} registered learners. The platform records tuition and inventory payments, allocates transactions by academic term, produces secure receipts and gives finance staff daily and term-based accounting reports. The proposed integration will allow confirmed bank transactions to reach the correct student account without manual re-entry.`);
  doc.setFillColor(240, 245, 250);
  doc.roundedRect(margin, y, pw - margin * 2, 28, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...primary);
  doc.text(data.studentCount.toLocaleString(), margin + 10, y + 14);
  doc.setFontSize(9);
  doc.text("LIVE REGISTERED LEARNERS", margin + 10, y + 21);
  doc.setFontSize(13);
  doc.text("ONE VERIFIED FINANCE LEDGER", pw - margin - 10, y + 16, { align: "right" });
  y += 38;
  title("2. How the Finance System Works");
  bulletList([
    "A permanent student account is created at registration and retained when the learner changes class or academic term.",
    "At the start of a new term, the approved fee requirement is applied while previous terms remain available for review and arrears collection.",
    "Cash, EcoCash, swipe and bank payments are recorded with amount, date and time, method, cashier, academic term, receipt number and payer reference.",
    "Bank payments received in a later term can still be allocated to an earlier outstanding term, preserving the actual collection date for daily accounting.",
    "Paid, part-paid and unpaid learners are classified per class and term. Daily cash-up reports separate cash collected, transfers, disbursements and closing totals per cashier.",
    "Payment edits and deletions are controlled and retained in audit history. Cloud backup and offline queues protect entries during connectivity interruptions.",
  ]);
  title("3. Student Registration and Payment Reference");
  paragraph("Each learner receives a unique six-character registration number when registered. The identifier is never reused and remains linked to the learner's fees, inventory purchases and history. For bank integration, this registration number will form the core of the payment reference so incoming transactions can be matched automatically. The payer may also include the learner's name, but the registration number is the authoritative matching key.");

  // Integration flow
  doc.addPage();
  addHeader("PROPOSED PAYMENT FLOW");
  title("4. End-to-End Banking Flow");
  autoTable(doc, {
    startY: y,
    head: [["Step", "Process", "System Result"]],
    body: [
      ["1", "Parent or guardian pays through an approved bank channel using the learner registration number.", "The bank creates a unique transaction reference."],
      ["2", "The bank sends a secure transaction notification or makes the transaction available for query.", "The platform validates source, amount, currency, status and reference."],
      ["3", "The registration number and agreed reference rules identify the student account.", "A confirmed payment is posted once to the selected or configured term."],
      ["4", "Duplicate transaction IDs and already-used references are rejected or flagged for review.", "No double-crediting occurs."],
      ["5", "The platform issues a numbered receipt with bank reference and QR verification.", "The payer and finance team receive auditable proof of payment."],
      ["6", "Settlement data is reconciled against posted payments and exceptions.", "Finance receives daily totals, unmatched items and discrepancy reports."],
    ],
    theme: "grid",
    headStyles: { fillColor: primary, textColor: 255 },
    styles: { fontSize: 8.5, cellPadding: 3, valign: "top" },
    columnStyles: { 0: { cellWidth: 13, halign: "center", fontStyle: "bold" }, 1: { cellWidth: 76 }, 2: { cellWidth: 73 } },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 12;
  title("5. Controls and Reporting");
  bulletList([
    "Unique bank transaction IDs, idempotent processing and duplicate-payment alerts.",
    "Verified payment status before account crediting; pending and failed payments do not produce paid receipts.",
    "Per-cashier daily opening and closing, payment timestamps, transfer totals, cash movements and signature blocks.",
    "Class, term, payment-status and collection-date reports, including arrears paid in the current day.",
    "Immutable receipt numbering, QR verification and a traceable history for corrections, reversals and deletions.",
    "Role-based access, encrypted transport, cloud backup and automatic synchronisation after offline operation.",
  ]);

  // Bank requirements
  doc.addPage();
  addHeader("REQUIREMENTS FROM THE BANK");
  title("6. Information and Access Required for Go-Live");
  paragraph(`To move from proposal to a live service, ${data.bankName || "the bank"} is requested to provide the following items or confirm the approved alternative used by the bank.`);
  autoTable(doc, {
    startY: y,
    head: [["Requirement", "What We Need from the Bank", "Purpose"]],
    body: [
      ["Technical documentation", "Current API specifications, message formats, status codes, limits and supported integration method.", "Build and validate the connection correctly."],
      ["Sandbox", "Test environment, test accounts, sample transactions and approved test cases.", "Complete development without affecting real funds."],
      ["Credentials", "Securely issued sandbox and production credentials, certificates, signing keys or OAuth details.", "Authenticate every request and notification."],
      ["Merchant setup", "Merchant/account identifiers, settlement account details, branches and enabled currencies.", "Route and settle school collections."],
      ["Payment services", "Payment initiation or reference collection, transaction enquiry and payment-status endpoints.", "Confirm a payment before crediting a learner."],
      ["Notifications", "Webhook/callback registration, event catalogue, signature verification and retry policy.", "Receive reliable real-time payment confirmations."],
      ["References", "Maximum length, allowed characters and support for the student's unique registration reference.", "Match transactions automatically to learners."],
      ["Reconciliation", "Settlement reports or API, transaction IDs, bank references, fees, net amounts and settlement dates.", "Balance the bank statement against system records."],
      ["Exceptions", "Rules and endpoints for reversals, refunds, duplicate payments, chargebacks, timeouts and disputes.", "Keep student balances and bank totals accurate."],
      ["Channels", "Confirmed support for mobile banking, internet banking, branch deposits, cards/POS and any real-time rails.", "Publish correct payment options to parents."],
      ["Security", "IP allow-listing, TLS requirements, encryption, request signing, key rotation and incident reporting process.", "Protect financial and personal information."],
      ["Compliance", "KYC/merchant onboarding forms, data-protection terms, retention rules and required approvals.", "Meet the bank's legal and risk requirements."],
      ["Go-live support", "Certification criteria, production approval, technical contact, escalation path and service availability.", "Launch safely and resolve incidents quickly."],
    ],
    theme: "grid",
    headStyles: { fillColor: primary, textColor: 255, fontSize: 8 },
    styles: { fontSize: 7.4, cellPadding: 2.3, valign: "top" },
    columnStyles: { 0: { cellWidth: 31, fontStyle: "bold" }, 1: { cellWidth: 84 }, 2: { cellWidth: 59 } },
    margin: { left: margin, right: margin },
  });

  // Responsibilities and go-live
  doc.addPage();
  addHeader("IMPLEMENTATION AND GO-LIVE");
  title("7. Responsibilities");
  autoTable(doc, {
    startY: y,
    head: [["Party", "Responsibilities"]],
    body: [
      [data.bankName || "Bank", "Provide approved access, documentation, onboarding, security requirements, test support, certification, production credentials, settlement information and operational escalation contacts."],
      [data.schoolName, "Complete merchant/KYC onboarding, nominate finance contacts, approve settlement accounts and reference rules, participate in user acceptance testing, and approve production launch."],
      ["Dataplex Softwares", "Develop and secure the integration, map bank transactions to student accounts, prevent duplicates, generate verified receipts, provide reconciliation and exception reports, support testing and maintain technical documentation."],
    ],
    theme: "grid",
    headStyles: { fillColor: primary, textColor: 255 },
    styles: { fontSize: 8.7, cellPadding: 3, valign: "top" },
    columnStyles: { 0: { cellWidth: 43, fontStyle: "bold" } },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 12;
  title("8. Go-Live Acceptance Checklist");
  const checklist = [
    "Commercial and merchant onboarding approved",
    "Sandbox credentials and documentation received",
    "Reference format and student matching approved",
    "Payment confirmation and duplicate controls tested",
    "Reversal, refund and failed-payment scenarios tested",
    "Settlement and daily reconciliation totals verified",
    "Security review and bank certification completed",
    "Production credentials issued through a secure channel",
    "Support contacts and escalation process confirmed",
    "Joint production launch approval signed",
  ];
  checklist.forEach((item, index) => {
    const col = index < 5 ? 0 : 1;
    const row = index % 5;
    const x = margin + col * 88;
    const cy = y + row * 12;
    doc.setDrawColor(...blue);
    doc.rect(x, cy - 4, 4, 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(35);
    const lines = doc.splitTextToSize(item, 78);
    doc.text(lines, x + 7, cy);
  });
  y += 69;
  title("9. Approval to Proceed");
  paragraph("This proposal is intended to begin the bank's technical and commercial assessment. No production connection will be activated until the bank, the school and Dataplex Softwares have completed testing, security approval and written go-live acceptance.");
  const stamp = await loadStampDataUrl();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...primary);
  doc.text("FOR DATAPLEX SOFTWARES", margin, 232);
  doc.text(`FOR ${data.bankName.toUpperCase() || "THE BANK"}`, 116, 232);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40);
  doc.text("Name: ______________________________", margin, 243);
  doc.text("Name: ______________________________", 116, 243);
  doc.text("Signature: __________________________", margin, 252);
  doc.text("Signature: __________________________", 116, 252);
  doc.text("Date: _______________________________", margin, 261);
  doc.text("Date: _______________________________", 116, 261);
  if (stamp) {
    doc.saveGraphicsState();
    // @ts-ignore jsPDF's runtime GState constructor is not exposed by its typings.
    doc.setGState(new (doc as any).GState({ opacity: 0.78 }));
    doc.addImage(stamp, "PNG", margin + 7, 221, 48, 47, "bank-proposal-stamp", "NONE", -12);
    doc.restoreGraphicsState();
  }

  await drawReceipt("fees");
  await drawReceipt("inventory");

  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(110);
    doc.text("Banking Integration Proposal • Confidential", margin, ph - 8);
    doc.text(`Page ${page} of ${total}`, pw - margin, ph - 8, { align: "right" });
  }

  const safeBank = (data.bankName || "Bank").replace(/[^a-z0-9]+/gi, "_");
  doc.save(`Bank_Integration_Proposal_${safeBank}.pdf`);
};
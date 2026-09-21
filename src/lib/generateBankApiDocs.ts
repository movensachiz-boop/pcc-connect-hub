import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface BankApiDocsData {
  bankName: string;
  bankContact?: string;
  schoolName: string;
  branch?: string;
  collectionAccount: string;
  inventoryAccount?: string;
  baseUrl: string;
  studentCount: number;
  preparedBy: string;
  contactEmail: string;
  contactPhone: string;
}

const primary: [number, number, number] = [0, 51, 102];
const blue: [number, number, number] = [41, 128, 185];

export const generateBankApiDocs = (data: BankApiDocsData) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const margin = 18;
  const generated = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  let y = margin;

  const header = (section: string) => {
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

  const footer = () => {
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setDrawColor(200);
      doc.line(margin, ph - 14, pw - margin, ph - 14);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(110);
      doc.text(`${data.schoolName} — API Integration Specification | Generated ${generated}`, margin, ph - 9);
      doc.text(`Page ${i} of ${pages}`, pw - margin, ph - 9, { align: "right" });
    }
  };

  const space = (needed: number, section: string) => {
    if (y + needed > ph - 22) { doc.addPage(); header(section); }
  };

  const title = (value: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...primary);
    doc.text(value, margin, y);
    y += 7;
  };

  const sub = (value: string) => {
    space(14, "SPECIFICATION");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...blue);
    doc.text(value, margin, y);
    y += 5.5;
  };

  const para = (value: string, gap = 4) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.3);
    doc.setTextColor(35);
    const lines = doc.splitTextToSize(value, pw - margin * 2);
    space(lines.length * 4.6 + gap, "SPECIFICATION");
    doc.text(lines, margin, y);
    y += lines.length * 4.6 + gap;
  };

  const code = (lines: string[]) => {
    const h = lines.length * 4.3 + 6;
    space(h + 4, "SPECIFICATION");
    doc.setFillColor(244, 246, 249);
    doc.setDrawColor(215, 222, 232);
    doc.roundedRect(margin, y - 3, pw - margin * 2, h, 1.5, 1.5, "FD");
    doc.setFont("courier", "normal");
    doc.setFontSize(8);
    doc.setTextColor(30, 40, 55);
    let ly = y + 2;
    lines.forEach(line => {
      doc.text(doc.splitTextToSize(line, pw - margin * 2 - 8)[0] ?? "", margin + 4, ly);
      ly += 4.3;
    });
    y += h + 4;
  };

  const table = (head: string[], body: (string | number)[][]) => {
    autoTable(doc, {
      startY: y,
      head: [head],
      body,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8.2, cellPadding: 2, textColor: 40 },
      headStyles: { fillColor: primary, textColor: 255, fontStyle: "bold", fontSize: 8.4 },
      alternateRowStyles: { fillColor: [246, 248, 251] },
      didDrawPage: () => { /* keep header consistent */ },
    });
    // @ts-expect-error jspdf-autotable augments the doc instance
    y = doc.lastAutoTable.finalY + 7;
  };

  // ---------- Cover ----------
  doc.setFillColor(...primary);
  doc.rect(0, 0, pw, 62, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(21);
  doc.setTextColor(255);
  doc.text("API INTEGRATION SPECIFICATION", margin, 30);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`${data.schoolName} — Fees Collection Interface`, margin, 40);
  doc.setFillColor(255, 215, 0);
  doc.rect(margin, 46, 46, 1.6, "F");
  doc.setFontSize(9);
  doc.text(`Prepared for ${data.bankName}`, margin, 55);

  y = 76;
  doc.setTextColor(35);
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  const meta: [string, string][] = [
    ["Prepared for", `${data.bankName}${data.bankContact ? ` — ${data.bankContact}` : ""}`],
    ["Prepared by", data.preparedBy],
    ["Contact", `${data.contactEmail} | ${data.contactPhone}`],
    ["Date", generated],
    ["API version", "v1"],
    ["Learners on the system", data.studentCount.toLocaleString()],
    ["Collection account", data.collectionAccount],
  ];
  meta.forEach(([k, v]) => {
    doc.setFont("helvetica", "bold");
    doc.text(k, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(doc.splitTextToSize(v, pw - margin * 2 - 45), margin + 45, y);
    y += 7;
  });

  y += 4;
  para(
    "This document answers the integration questions raised by the bank. It describes the authentication method, the live endpoints, the request and response formats, the fee categories supported, and the operational rules for reconciliation, duplicates and reversals.",
  );

  // ---------- Overview ----------
  doc.addPage();
  header("1. OVERVIEW & AUTHENTICATION");
  title("1. Overview and Authentication");
  para(
    `The school operates a cloud-hosted fees management system. Every learner holds a permanent six-character registration number that is used as the payment reference at the point of sale. The bank posts collections to the school system in real time through a secured HTTPS interface; each accepted posting immediately produces an official school receipt that can be verified online.`,
  );

  sub("Authentication method");
  para(
    "Authentication uses a long-lived Bearer API key issued by the school to the bank. The key is transmitted in the Authorization header of every request over TLS 1.2+. Keys are stored hashed, can be rotated or revoked instantly by the school, and separate keys are issued for test and production.",
  );
  code([
    "Authorization: Bearer <API_KEY>",
    "Content-Type: application/json",
  ]);

  sub("Base URL");
  code([`${data.baseUrl}`, "All paths below are relative to this base URL. Protocol: HTTPS only."]);

  sub("Endpoint summary");
  table(
    ["Purpose", "Method", "Path"],
    [
      ["Health check", "GET", "/health"],
      ["Student list (paged)", "GET", "/students?page=1&limit=50&search=&form="],
      ["Student lookup", "GET", "/students/{registration_number}"],
      ["Post a payment", "POST", "/payments"],
      ["Payment history / status", "GET", "/students/{registration_number}/payments"],
      ["Fee categories", "GET", "/fee-categories"],
    ],
  );

  // ---------- Endpoints ----------
  doc.addPage();
  header("2. ENDPOINT REFERENCE");
  title("2. Endpoint Reference");

  sub("2.1 Student list — GET /students");
  para("Returns the learner register in pages. Supports search by name or registration number and filtering by form.");
  code([
    `curl -H "Authorization: Bearer <API_KEY>" \\`,
    `  "${data.baseUrl}/students?page=1&limit=50"`,
    "",
    '{ "page":1, "limit":50, "total":' + data.studentCount + ', "students":[',
    '   { "registration_number":"A1B2C3", "full_name":"Tafadzwa Moyo",',
    '     "class":"Form 3 Gold", "form":"3", "stream":"Gold", "status":"active" } ] }',
  ]);

  sub("2.2 Student lookup — GET /students/{registration_number}");
  para("Used at the POS before accepting cash: confirms the learner exists and returns the current outstanding balance.");
  code([
    `curl -H "Authorization: Bearer <API_KEY>" \\`,
    `  "${data.baseUrl}/students/A1B2C3"`,
    "",
    '{ "student": { "registration_number":"A1B2C3", "full_name":"Tafadzwa Moyo",',
    '    "class":"Form 3 Gold", "term":{"name":"Term 2 2026"}, "currency":"USD",',
    '    "total_fees":285.00, "total_paid":120.00, "outstanding_balance":165.00,',
    '    "payment_status":"Outstanding" }, "recent_payments":[ ... ] }',
  ]);

  sub("2.3 Post a payment — POST /payments");
  para("Called by the bank once funds are confirmed. The school system records the payment, updates the balance and returns the official receipt number.");
  table(
    ["Field", "Type", "Required", "Notes"],
    [
      ["registration_number", "string", "Yes", "Six-character learner reference"],
      ["amount", "number", "Yes", "Positive, 2 decimals"],
      ["currency", "string", "Yes", "USD"],
      ["bank_reference", "string", "Yes", "Unique per transaction; used for idempotency"],
      ["fee_category", "string", "Yes", "TUITION or LEVY"],
      ["channel", "string", "No", "POS, Bank Transfer, Mobile Banking, Cash"],
      ["payer_name", "string", "No", "Name of the depositor"],
      ["transaction_date", "string", "No", "ISO 8601 timestamp"],
    ],
  );
  code([
    `curl -X POST "${data.baseUrl}/payments" \\`,
    `  -H "Authorization: Bearer <API_KEY>" -H "Content-Type: application/json" \\`,
    `  -d '{"registration_number":"A1B2C3","amount":100.00,"currency":"USD",`,
    `       "bank_reference":"NBS20260921000123","fee_category":"TUITION",`,
    `       "channel":"POS","payer_name":"R. Moyo"}'`,
    "",
    '{ "success":true, "receipt_number":"RCP-1245", "student_name":"Tafadzwa Moyo",',
    '  "amount":100.00, "currency":"USD", "bank_reference":"NBS20260921000123",',
    '  "posted_at":"2026-09-21T09:15:22Z", "verification_url":"https://..." }',
  ]);

  sub("2.4 Payment history / status — GET /students/{reg}/payments");
  para("Returns up to 200 of the learner's most recent payments with receipt number, amount, channel, bank reference and status. Used for statement enquiries and end-of-day reconciliation.");

  sub("2.5 Fee categories — GET /fee-categories");
  para("Returns the live list of collectable categories so the bank's POS menu stays in step with the school.");

  // ---------- Fee categories & account ----------
  doc.addPage();
  header("3. FEE CATEGORIES & ACCOUNT");
  title("3. Fee Categories and Collection Account");
  table(
    ["Product code", "Fee category", "Description"],
    [
      ["TUITION", "Tuition / School Fees", "Termly school fees for Forms 1 to 6"],
      ["LEVY", "Levy", "Class levies, including the Gold stream levy"],
    ],
  );
  para("Both categories settle into a single school collection account. The fee category is carried on the transaction so the school system can classify the receipt.");
  sub("School collection account");
  table(
    ["Detail", "Value"],
    [
      ["Account name", data.schoolName],
      ["Account number", data.collectionAccount],
      ["Branch", data.branch || "-"],
      ["Bank", data.bankName],
      ["Currency", "USD"],
      ["Payment reference", "Learner registration number (six characters)"],
    ],
  );

  sub("Registration numbers");
  para(
    "Each learner is issued a permanent six-character alphanumeric registration number on enrolment. It never changes, is printed on the learner's ID card and on every receipt, and is the only reference required at the bank counter or POS.",
  );

  // ---------- Operations ----------
  doc.addPage();
  header("4. OPERATING RULES");
  title("4. Responses, Duplicates and Reconciliation");
  table(
    ["HTTP", "Meaning", "Action by the bank"],
    [
      ["200 / 201", "Accepted and receipted", "Print receipt number on the POS slip"],
      ["400", "Validation failed", "Correct the field listed in details and resend"],
      ["401", "Invalid or revoked key", "Contact the school for key reissue"],
      ["404", "Learner not found", "Recheck the registration number with the payer"],
      ["429 / 500", "Temporary failure", "Retry with the same bank_reference (safe)"],
    ],
  );
  sub("Duplicate protection");
  para("bank_reference is unique. Resending the same reference never creates a second receipt — the original receipt is returned with duplicate: true, so retries are always safe.");
  sub("Reversals and refunds");
  para("Reversals are handled by the school finance office: the receipt is voided in the system with a full audit record, and the bank is notified in the daily reconciliation. Automated reversal endpoints can be added on request.");
  sub("Reconciliation");
  para("The school reconciles daily using the bank_reference against the bank settlement file. A daily transaction report and a per-cashier collection report are produced by the system. The school can also accept a settlement file by SFTP if the bank prefers batch reconciliation.");
  sub("Security");
  para("HTTPS/TLS only, hashed API keys, optional IP allow-listing for the bank's gateway, full request logging with timestamps and status codes, and instant key revocation. No card data is stored by the school system.");
  sub("Next steps");
  para("1. The school issues a test key. 2. The bank tests lookup and payment posting in the sandbox. 3. Both parties sign off on reconciliation. 4. The school issues the production key and go-live is scheduled.");

  footer();
  doc.save(`${data.schoolName.replace(/\s+/g, "_")}_API_Integration_Spec.pdf`);
};

export const DEFAULT_PROVIDER = {
  name: "Takudzwa Singo",
  business_type: "Sole Vendor",
  address: "",
  phone: "",
  email: "",
};

export const DEFAULT_PRICING = {
  termly_fee: 90.0,
  terms_per_year: 3,
  annual_fee: 270.0,
  integration_fee: 800.0,
  currency: "USD",
  installations: [
    "Bonnyvale Campus School Management System",
    "Mkoba 14 Campus School Management System",
  ],
  covers: [
    "Server hosting and infrastructure costs",
    "Database hosting, maintenance and backups",
    "Domain name and SSL security certificate renewal",
    "Security updates and patches",
    "System monitoring and performance optimisation",
    "Bug fixes",
    "Technical support",
  ],
  integration_costs: [
    "Requirements analysis and liaison with National Building Society (NBS)",
    "Design and writing of the bank API documentation",
    "Development of the secure API connection path (endpoints) between the bank and the school system",
    "Authentication and access-key security for the bank connection",
    "Payment matching and reconciliation logic using student registration numbers as payment references",
    "Receipt generation and QR-code verification for bank payments",
    "Testing and certification support with the bank's technical team",
    "Deployment, go-live support and post-launch monitoring",
  ],
  excludes: [
    "New modules",
    "Custom software development",
    "Major feature requests",
    "Third-party integrations",
  ],
  notice:
    "Additional modules and custom developments are quoted and billed separately.",
};

export const DEFAULT_SECTIONS: Record<string, string> = {
  purpose:
    "This Service Level Agreement (SLA) defines the support, maintenance, and service levels to be provided by Takudzwa Singo for the School Management Software installed at the Client. The purpose of this agreement is to ensure that the software remains operational, secure, and reliable while clearly defining the responsibilities of both parties.",
  scope:
    "This agreement covers software maintenance, bug fixes, technical support, security updates, database maintenance, performance optimisation, system monitoring and user support for the listed installations.",
  excluded:
    "Development of new modules, major feature enhancements, custom reports requested after deployment, third-party software integration, and hardware repairs or replacement are NOT included. Any additional modules or custom developments shall be quoted separately and will only commence upon written approval.",
  availability:
    "Target system availability is 99% uptime, excluding scheduled maintenance and events beyond the Service Provider's control. Scheduled maintenance shall normally be performed outside school operating hours where practical. The Service Provider shall give the Client at least forty-eight (48) hours' notice of planned maintenance that may affect service availability.",
  support_hours:
    "Normal Support: Monday to Friday, 08:00 – 17:00. Emergency support for Critical incidents (complete system failure) shall be available outside normal working hours, including weekends and public holidays, with a response within two (2) hours of the incident being reported by telephone or WhatsApp.",
  response_times:
    "Critical (complete system failure): respond 30 min, resolve 4 hrs. High (major function unavailable): respond 1 hr, resolve 8 hrs. Medium (operational issue affecting some users): respond 4 hrs, resolve 24 hrs. Low (minor bug or cosmetic): respond 1 business day, resolve 5 business days.",
  provider_resp:
    "The Service Provider agrees to maintain the software, correct software defects, perform routine maintenance, protect the integrity of the database, provide technical support and maintain the confidentiality of Client information.",
  school_resp:
    "The Client agrees to provide access to the software when support is required, protect user accounts and passwords, report software issues promptly, ensure authorised users operate the system responsibly, and pay service fees on time.",
  data_ownership:
    "All student, staff, financial and administrative data entered into the system remains the sole property of the Client. The Service Provider shall not disclose or use such data except as necessary to provide support services or where required by law.",
  software_ownership:
    "The School Management Software, its source code, intellectual property rights and related documentation remain the sole property of the Service Provider unless otherwise agreed in writing. This Agreement grants the Client the right to use the software for the duration of this Agreement.",
  backup_recovery:
    "The Service Provider shall maintain routine backups of hosted data. In the event of data loss caused by system failure, reasonable efforts shall be made to restore data from the most recent available backup. The Service Provider does not guarantee recovery of all data where data loss results from user actions, malware or third-party failures.",
  fees:
    "The Client agrees to pay a system maintenance fee of USD $90.00 per school term (USD $270.00 per year, three terms). Payments shall be due within fourteen (14) days of the invoice date. The Service Provider reserves the right to suspend support services for accounts more than thirty (30) days overdue until all outstanding balances are settled.",
  bank_integration:
    "A one-off installation and integration fee of USD $800.00 has been paid for the bank-to-application integration with National Building Society (NBS). This fee covers the full scope of work delivered, itemised below.",
  confidentiality:
    "Both parties agree to keep confidential all information relating to students, staff, finances, passwords, databases and any other sensitive information obtained during the course of this Agreement.",
  termination:
    "Either party may terminate this Agreement by giving thirty (30) days' written notice. Any outstanding fees for services rendered prior to termination shall remain payable.",
  liability:
    "The Service Provider shall not be liable for losses resulting from hardware failures, user negligence or viruses introduced by users.",
  force_majeure:
    "Neither party shall be liable for failure to perform its obligations due to events beyond its reasonable control, including natural disasters, war, government restrictions, telecommunications failures, internet outages or electrical power disruptions.",
  governing_law:
    "This Agreement shall be governed by and construed in accordance with the laws of Zimbabwe. Any disputes arising from this Agreement shall be subject to the exclusive jurisdiction of the courts of Zimbabwe.",
  acceptance:
    "Signed and accepted by both parties, in the presence of witnesses, on the dates indicated below.",
};

export const SECTION_ORDER: { key: string; title: string }[] = [
  { key: "purpose", title: "1. Purpose" },
  { key: "scope", title: "2. Scope of Services" },
  { key: "excluded", title: "3. Excluded Services" },
  { key: "availability", title: "4. Service Availability and Scheduled Maintenance" },
  { key: "support_hours", title: "5. Support Hours" },
  { key: "response_times", title: "6. Incident Response Times" },
  { key: "provider_resp", title: "7. Responsibilities of the Service Provider" },
  { key: "school_resp", title: "8. Responsibilities of the Client" },
  { key: "data_ownership", title: "9. Data Ownership" },
  { key: "software_ownership", title: "10. Ownership of Software" },
  { key: "backup_recovery", title: "11. Backup and Recovery" },
  { key: "fees", title: "12. Fees and Payment Terms" },
  { key: "bank_integration", title: "13. Bank Integration (One-Off)" },
  { key: "confidentiality", title: "14. Confidentiality" },
  { key: "termination", title: "15. Termination" },
  { key: "liability", title: "16. Limitation of Liability" },
  { key: "force_majeure", title: "17. Force Majeure" },
  { key: "governing_law", title: "18. Governing Law" },
  { key: "acceptance", title: "19. Acceptance" },
];

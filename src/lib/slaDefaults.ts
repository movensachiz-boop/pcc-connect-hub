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
  integration_fee: 600.0,
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
    "Target system availability is 99% uptime, excluding scheduled maintenance and events beyond the service provider's control.",
  support_hours:
    "Normal Support: Monday to Friday, 08:00 – 17:00. Emergency support for critical system failures shall be provided outside normal working hours where reasonably possible.",
  response_times:
    "Critical (complete system failure): respond 30 min, resolve 4 hrs. High (major function unavailable): respond 1 hr, resolve 8 hrs. Medium (operational issue affecting some users): respond 4 hrs, resolve 24 hrs. Low (minor bug or cosmetic): respond 1 business day, resolve 5 business days.",
  provider_resp:
    "Takudzwa Singo agrees to maintain the software, correct software defects, perform routine maintenance, protect the integrity of the database, provide technical support and maintain confidentiality of school information.",
  school_resp:
    "The Client agrees to provide access to the software when support is required, protect user accounts and passwords, report software issues promptly, ensure authorised users operate the system responsibly, and pay service fees on time.",
  data_ownership:
    "All student, staff, financial, and administrative data entered into the system remains the sole property of the Client. Takudzwa Singo shall not disclose or use such data except as necessary to provide support services or where required by law.",
  fees:
    "The Client agrees to pay a system maintenance fee of USD $90.00 per school term (USD $270.00 per year, three terms). This fee covers server hosting and infrastructure, database hosting, maintenance and backups, domain name and SSL security certificate renewal, security updates and patches, system monitoring and performance optimisation, bug fixes and technical support for the listed installations. New modules, custom development, major feature requests and third-party integrations are billed separately. Payments shall be made on or before the agreed due date each term.",
  bank_integration:
    "A one-off integration fee of USD $600.00 is charged for the bank-to-application integration with National Building Society (NBS). This fee covers the full scope of work delivered: requirements analysis and liaison with the bank, design and writing of the bank API documentation, development of the secure API connection path between the bank and the school system, authentication and access-key security, payment matching and reconciliation using student registration numbers as payment references, receipt generation with QR-code verification, testing and certification support with the bank's technical team, and deployment and go-live support.",
  confidentiality:
    "Both parties agree to keep confidential all information relating to students, staff, finances, passwords, databases, and any other sensitive information obtained during the course of this agreement.",
  termination:
    "Either party may terminate this agreement by giving thirty (30) days' written notice. Any outstanding fees for services rendered prior to termination shall remain payable.",
  liability:
    "The Service Provider shall not be liable for losses resulting from power failures, internet outages, hardware failures, user negligence, viruses introduced by users, or natural disasters and events beyond reasonable control.",
  acceptance:
    "Signed and accepted by both parties on the date indicated below.",
};

export const SECTION_ORDER: { key: string; title: string }[] = [
  { key: "purpose", title: "1. Purpose" },
  { key: "scope", title: "2. Scope of Services" },
  { key: "excluded", title: "3. Excluded Services" },
  { key: "availability", title: "4. Service Availability" },
  { key: "support_hours", title: "5. Support Hours" },
  { key: "response_times", title: "6. Incident Response Times" },
  { key: "provider_resp", title: "7. Responsibilities of the Service Provider" },
  { key: "school_resp", title: "8. Responsibilities of the School" },
  { key: "data_ownership", title: "9. Data Ownership" },
  { key: "fees", title: "10. Fees" },
  { key: "bank_integration", title: "11. Bank Integration (One-Off)" },
  { key: "confidentiality", title: "12. Confidentiality" },
  { key: "termination", title: "13. Termination" },
  { key: "liability", title: "14. Limitation of Liability" },
  { key: "acceptance", title: "15. Acceptance" },
];

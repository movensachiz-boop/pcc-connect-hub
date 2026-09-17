# Bank Integration Proposal

## Goal
Create a separate, bank-ready PDF proposal for putting the school payment system live. It will not be presented as an SLA.

## Changes
- Add a dedicated **Bank Integration** section in the Developer Portal with its own download button.
- Generate a professionally branded proposal addressed to the bank, using the live registered-student count.
- Explain the complete finance flow: student accounts, term allocation, bank payment matching, cashier controls, reconciliation, audit history, reports, backups, and receipt verification.
- Explain how permanent six-character student registration numbers are issued and used as payment references.
- Include full-size realistic examples of both the school-fees receipt and inventory receipt, including QR verification.
- Add a clear **Requirements from the Bank** section covering:
  - API documentation and sandbox access
  - secure credentials and production access
  - account and merchant identifiers
  - payment-status and transaction-query services
  - webhook/callback configuration and security
  - unique payment-reference support
  - settlement and reconciliation files/APIs
  - reversals, refunds, duplicate handling, and dispute procedures
  - supported payment channels and currencies
  - security, compliance, data-protection, testing, certification, support, and go-live approval
- Add an implementation and go-live checklist showing responsibilities for the bank, school, and Dataplex Softwares.
- Remove the bank proposal content and receipt appendices from the SLA PDF so the two documents remain separate.

## Verification
- Generate the proposal PDF and inspect every page for clipping, overlap, correct page order, branding, QR codes, and readable receipt examples.

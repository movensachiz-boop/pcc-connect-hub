import { describe, expect, it } from "vitest";
import { buildBankCollections, matchesBankCollection, type BankFeeRow, type BankInventoryRow } from "../lib/bankTransactions";

const fee: BankFeeRow = {
  id: "1", amount: 10, currency: "USD", receipt_number: "RCP-1",
  paynow_reference: "NBS-123", bank_name: "National Building Society",
  description: "Tuition / School Fees — NBS (Guardian)", created_at: "2026-10-21T07:00:00Z", status: "paid",
  profiles: { first_name: "NYASHA", last_name: "TARUONA", registration_number: "A2333E", form: "3", stream: "Blue" },
};
const sale: BankInventoryRow = {
  id: "2", total_amount: 15, currency: "USD", receipt_number: "INV-2",
  notes: "NBS TRIP — bank reference bank ref 2 (Guardian)", created_at: fee.created_at, status: "paid", profiles: fee.profiles,
};

describe("bank transaction list", () => {
  it("excludes manual deposits and non-bank inventory transactions", () => {
    const rows = buildBankCollections([fee, { ...fee, id: "manual", description: "Bank deposit" }, { ...fee, bank_name: "Other bank" }], [sale, { ...sale, notes: "Cash uniforms" }]);
    expect(rows.map(row => row.id)).toEqual(["fee-1", "inventory-2"]);
    expect(rows.reduce((total, row) => total + row.amount, 0)).toBe(25);
  });
  it("automatically displays the linked student's registration number when searching by name", () => {
    const row = buildBankCollections([fee], [])[0];
    expect(matchesBankCollection(row, "taruona nyasha")).toBe(true);
    expect(row.registration).toBe("A2333E");
    expect(matchesBankCollection(row, "different learner")).toBe(false);
  });
  it("does not invent a registration number from the payer when a learner is unlinked", () => {
    const row = buildBankCollections([{ ...fee, profiles: null }], [])[0];
    expect(row.registration).toBe("");
  });
  it("searches normalized registration numbers and bank references", () => {
    const row = buildBankCollections([fee], [])[0];
    expect(matchesBankCollection(row, "a-2333 e")).toBe(true);
    expect(matchesBankCollection(row, "NBS-123")).toBe(true);
    expect(matchesBankCollection(row, "NBS-456")).toBe(false);
  });
  it("keeps the complete bank reference and filters trip transactions separately", () => {
    const row = buildBankCollections([], [sale])[0];
    expect(row.reference).toBe("bank ref 2");
    expect(matchesBankCollection(row, "", "Trip")).toBe(true);
    expect(matchesBankCollection(row, "", "Uniforms")).toBe(false);
  });
});
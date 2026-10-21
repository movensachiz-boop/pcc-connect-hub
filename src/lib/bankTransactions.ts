import { formatClass, normalizeRegNo, titleCaseName } from "./normalize";

export type BankCollection = {
  id: string;
  category: "Tuition" | "Levy" | "Uniforms" | "Trip";
  amount: number;
  currency: string;
  receipt: string | null;
  reference: string | null;
  student: string;
  registration: string;
  className: string;
  created_at: string;
  status: string;
  payer: string;
  description?: string | null;
  verificationHash?: string | null;
  items?: { name: string; quantity: number; unit_price: number; subtotal: number }[];
};

type Student = {
  first_name: string;
  last_name: string;
  registration_number: string;
  form: string | null;
  stream: string | null;
};

export type BankFeeRow = {
  id: string;
  amount: number;
  currency: string;
  receipt_number: string | null;
  paynow_reference: string | null;
  bank_name: string | null;
  description: string | null;
  created_at: string;
  status: string;
  verification_hash?: string | null;
  profiles: Student | null;
};

export type BankInventoryRow = {
  id: string;
  total_amount: number;
  currency: string;
  receipt_number: string | null;
  notes: string | null;
  created_at: string;
  status: string;
  items?: any;
  profiles: Student | null;
};

const identity = (profile: Student | null) => ({
  student: profile ? titleCaseName(`${profile.first_name} ${profile.last_name}`) : "Unlinked learner",
  // Use only the profile actually attached to the payment; never guess from a payer's name.
  registration: profile?.registration_number || "",
  className: formatClass(profile),
});

export function buildBankCollections(fees: BankFeeRow[], inventory: BankInventoryRow[]): BankCollection[] {
  const feeCollections: BankCollection[] = fees
    .filter(row => row.bank_name === "National Building Society" && !!row.paynow_reference && / — NBS(?: \(.*\))?$/.test(row.description || ""))
    .map(row => ({
      id: `fee-${row.id}`,
      category: /levy/i.test(row.description || "") ? "Levy" : "Tuition",
      amount: Number(row.amount), currency: row.currency,
      receipt: row.receipt_number, reference: row.paynow_reference,
      created_at: row.created_at, status: row.status,
      payer: row.description?.match(/ — NBS \((.*)\)$/)?.[1] || "",
      description: row.description, verificationHash: row.verification_hash ?? null,
      ...identity(row.profiles),
    }));
  const inventoryCollections: BankCollection[] = inventory
    .filter(row => /^NBS (UNIFORMS|TRIP) — bank reference \S+/i.test(row.notes || ""))
    .map(row => ({
      id: `inventory-${row.id}`,
      category: /^NBS TRIP /i.test(row.notes || "") ? "Trip" : "Uniforms",
      amount: Number(row.total_amount), currency: row.currency,
      receipt: row.receipt_number,
      reference: row.notes?.match(/ — bank reference (.*?)(?: \(.*\))?$/)?.[1] || null,
      created_at: row.created_at, status: row.status,
      payer: row.notes?.match(/ \((.*)\)$/)?.[1] || "",
      items: Array.isArray(row.items) ? row.items.map((i: any) => ({ name: String(i.name ?? ""), quantity: Number(i.quantity ?? 1), unit_price: Number(i.unit_price ?? 0), subtotal: Number(i.subtotal ?? 0) })) : undefined,
      ...identity(row.profiles),
    }));
  return [...feeCollections, ...inventoryCollections].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function matchesBankCollection(row: BankCollection, search: string, category = "all"): boolean {
  if (category !== "all" && row.category !== category) return false;
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  if (normalizeRegNo(row.registration).includes(normalizeRegNo(search))) return true;
  const text = [row.student, row.registration, row.reference, row.receipt, row.payer, row.className].join(" ").toLowerCase();
  return words.every(word => text.includes(word));
}
import type { EnrolmentDocData } from "@/lib/generateEnrolmentDoc";

export const DEFAULT_BOOKS = [
  "35x72pgs, 10 x counter bks",
  "1X Plain Book",
  "1X Graph book",
  "Mathematical Set",
];

const girlsLower = [
  { name: "Black skirt + Dress", qty: 2, price: 32 },
  { name: "White long blouse", qty: 1, price: 15 },
  { name: "Bus Levy", qty: 1, price: 25 },
  { name: "Jersey", qty: 1, price: 25 },
  { name: "Blazer", qty: 1, price: 50 },
  { name: "Track Suit", qty: 1, price: 45 },
  { name: "T-Shirt", qty: 1, price: 10 },
  { name: "Sunhat", qty: 1, price: 10 },
  { name: "Anorak", qty: 1, price: 45 },
  { name: "Slack", qty: 1, price: 15 },
  { name: "Golf T shirt", qty: 1, price: 10 },
  { name: "Bond Paper", qty: 1, price: 6 },
  { name: "Tie", qty: 1, price: 20 },
  { name: "White socks", qty: 2, price: 1 },
  { name: "Report Book", qty: 1, price: 8 },
  { name: "Basher hat", qty: 1, price: 25 },
  { name: "Satchel", qty: 1, price: 20 },
  { name: "Cap", qty: 1, price: 5 },
];

const boysLower = [
  { name: "Black trousers", qty: 2, price: 15 },
  { name: "White shirt", qty: 2, price: 15 },
  { name: "Bus Levy", qty: 1, price: 25 },
  { name: "Jersey", qty: 1, price: 25 },
  { name: "Blazer", qty: 1, price: 45 },
  { name: "Track Suit", qty: 1, price: 45 },
  { name: "T-Shirt", qty: 1, price: 10 },
  { name: "Anorak", qty: 1, price: 45 },
  { name: "Tie", qty: 1, price: 7 },
  { name: "Sunhat", qty: 1, price: 10 },
  { name: "Golf T shirt", qty: 1, price: 10 },
  { name: "Grey socks", qty: 2, price: 1 },
  { name: "Report Book", qty: 1, price: 8 },
  { name: "Bond Paper", qty: 1, price: 6 },
  { name: "Satchel", qty: 1, price: 20 },
  { name: "Cap", qty: 1, price: 5 },
];

const upperExtras = [
  { name: "Labcoat", qty: 1, price: 20 },
  { name: "Worksuit", qty: 1, price: 20 },
];

export interface EnrolmentPreset {
  id: string;
  title: string;
  description: string;
  data: EnrolmentDocData;
}

const base = {
  year: "2027",
  campus: "Mkoba Campus",
  books: DEFAULT_BOOKS,
  footNote: "NB*** Fridays (White takkies). Stationery pack US$50. All prices are in USD and subject to change.",
};

export const ENROLMENT_PRESETS: EnrolmentPreset[] = [
  {
    id: "f1-4-girls",
    title: "Form 1 - 4 (Girls)",
    description: "Fees, books and full girls uniform list",
    data: {
      ...base,
      levelLabel: "Form 1 - 4",
      uniformHeading: "Girls Form 1- 4",
      fees: [
        { label: "Admission Fee", amount: "$20.00" },
        { label: "Fees", amount: "$270.00" },
        { label: "Science levy", amount: "$30.00" },
        { label: "Total", amount: "$320.00" },
      ],
      uniforms: girlsLower,
    },
  },
  {
    id: "f1-4-boys",
    title: "Form 1 - 4 (Boys)",
    description: "Fees, books and full boys uniform list",
    data: {
      ...base,
      levelLabel: "Form 1 - 4",
      uniformHeading: "Boys Form 1- 4",
      fees: [
        { label: "Admission Fee", amount: "$20.00" },
        { label: "Fees", amount: "$270.00" },
        { label: "Science levy", amount: "$30.00" },
        { label: "Total", amount: "$320.00" },
      ],
      uniforms: boysLower,
    },
  },
  {
    id: "l6u6-comm-girls",
    title: "Commercials & Arts L6/U6 (Girls)",
    description: "Lower & Upper 6 Commercials and Arts",
    data: {
      ...base,
      levelLabel: "Commercials and Arts (L6&U6)",
      uniformHeading: "Girls Form 5 - 6",
      fees: [
        { label: "Admission Fee", amount: "$20.00" },
        { label: "Fees", amount: "$275.00" },
        { label: "Science levy", amount: "$30.00" },
        { label: "Total", amount: "$325.00" },
      ],
      uniforms: girlsLower,
    },
  },
  {
    id: "l6u6-comm-boys",
    title: "Commercials & Arts L6/U6 (Boys)",
    description: "Lower & Upper 6 Commercials and Arts",
    data: {
      ...base,
      levelLabel: "Commercials and Arts (L6&U6)",
      uniformHeading: "Boys Form 5 - 6",
      fees: [
        { label: "Admission Fee", amount: "$20.00" },
        { label: "Fees", amount: "$275.00" },
        { label: "Science levy", amount: "$30.00" },
        { label: "Total", amount: "$325.00" },
      ],
      uniforms: boysLower,
    },
  },
  {
    id: "l6u6-sci-girls",
    title: "Sciences L6/U6 (Girls)",
    description: "Includes labcoat and worksuit",
    data: {
      ...base,
      levelLabel: "Sciences (L6&U6)",
      uniformHeading: "Girls Sciences Form 5 - 6",
      fees: [
        { label: "Admission Fee", amount: "$20.00" },
        { label: "Fees", amount: "$285.00" },
        { label: "Science levy", amount: "$30.00" },
        { label: "Total", amount: "$335.00" },
      ],
      uniforms: [...girlsLower, ...upperExtras],
    },
  },
  {
    id: "l6u6-sci-boys",
    title: "Sciences L6/U6 (Boys)",
    description: "Includes labcoat and worksuit",
    data: {
      ...base,
      levelLabel: "Sciences (L6&U6)",
      uniformHeading: "Boys Sciences Form 5 - 6",
      fees: [
        { label: "Admission Fee", amount: "$20.00" },
        { label: "Fees", amount: "$285.00" },
        { label: "Science levy", amount: "$30.00" },
        { label: "Total", amount: "$335.00" },
      ],
      uniforms: [...boysLower, ...upperExtras],
    },
  },
];

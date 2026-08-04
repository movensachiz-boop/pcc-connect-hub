// Shared exam-results analytics helpers (grading, aggregation, stats).

export interface RawMark {
  student_profile_id: string;
  form: string;
  stream: string;
  subject_id: string;
  subject_name: string | null;
  term: string;
  exam_type: string;
  mark: number;
  max_mark: number;
}

export interface StudentResult {
  id: string;
  name: string;
  reg: string;
  subjects: Record<string, number>; // subject name -> percentage
  total: number;
  average: number;
  grade: string;
  count: number;
  position: number;
}

export interface ClassAnalytics {
  students: StudentResult[];
  subjectNames: string[];
  classAverage: number;
  passRate: number;
  passCount: number;
  failCount: number;
  entered: number;
  gradeDistribution: { name: string; count: number }[];
  subjectAverages: { name: string; average: number }[];
  best?: StudentResult;
  worst?: StudentResult;
}

export const gradeFor = (pct: number): string => {
  if (pct >= 75) return "A";
  if (pct >= 65) return "B";
  if (pct >= 50) return "C";
  if (pct >= 40) return "D";
  if (pct >= 30) return "E";
  return "U";
};

/** C and above is a pass; D and below is a fail. */
export const isPass = (grade: string) => ["A", "B", "C"].includes(grade);

export const GRADES = ["A", "B", "C", "D", "E", "U"];

export function buildClassAnalytics(
  marks: RawMark[],
  profiles: { id: string; first_name: string; last_name: string; registration_number: string }[]
): ClassAnalytics {
  const byStudent = new Map<string, StudentResult>();
  const subjectNames = new Set<string>();

  for (const p of profiles) {
    byStudent.set(p.id, {
      id: p.id,
      name: `${p.first_name} ${p.last_name}`.trim(),
      reg: p.registration_number,
      subjects: {},
      total: 0,
      average: 0,
      grade: "—",
      count: 0,
      position: 0,
    });
  }

  for (const m of marks) {
    const s = byStudent.get(m.student_profile_id);
    if (!s) continue;
    const name = m.subject_name || m.subject_id;
    const pct = m.max_mark > 0 ? Math.round((Number(m.mark) / Number(m.max_mark)) * 100) : 0;
    s.subjects[name] = pct;
    subjectNames.add(name);
  }

  const students = [...byStudent.values()].map((s) => {
    const vals = Object.values(s.subjects);
    const total = vals.reduce((a, b) => a + b, 0);
    const average = vals.length ? Math.round(total / vals.length) : 0;
    return { ...s, total, average, count: vals.length, grade: vals.length ? gradeFor(average) : "—" };
  });

  students.sort((a, b) => (b.count ? b.average : -1) - (a.count ? a.average : -1));
  students.forEach((s, i) => (s.position = s.count ? i + 1 : 0));

  const graded = students.filter((s) => s.count > 0);
  const classAverage = graded.length
    ? Math.round(graded.reduce((a, s) => a + s.average, 0) / graded.length)
    : 0;
  const passCount = graded.filter((s) => isPass(s.grade)).length;
  const failCount = graded.length - passCount;

  const gradeDistribution = GRADES.map((g) => ({
    name: g,
    count: graded.filter((s) => s.grade === g).length,
  }));

  const names = [...subjectNames].sort();
  const subjectAverages = names.map((n) => {
    const vals = students.map((s) => s.subjects[n]).filter((v) => typeof v === "number");
    return {
      name: n,
      average: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0,
    };
  });

  return {
    students,
    subjectNames: names,
    classAverage,
    passRate: graded.length ? Math.round((passCount / graded.length) * 100) : 0,
    passCount,
    failCount,
    entered: graded.length,
    gradeDistribution,
    subjectAverages,
    best: graded[0],
    worst: graded[graded.length - 1],
  };
}

import { Teacher } from "@/types/school";

const KEY = (userId: string) => `teacher_subjects_${userId}`;

export function getMySubjects(userId: string): string[] {
  try { return JSON.parse(localStorage.getItem(KEY(userId)) || "[]"); } catch { return []; }
}

export function setMySubjects(userId: string, subjectIds: string[]) {
  localStorage.setItem(KEY(userId), JSON.stringify(subjectIds));
}

/** Match a teacher record by fullName (case-insensitive, trimmed). */
export function findAdminTeacher(teachers: Teacher[], fullName: string): Teacher | null {
  const n = fullName.trim().toLowerCase();
  if (!n) return null;
  return teachers.find(t => t.name.trim().toLowerCase() === n) || null;
}

/**
 * Admin assignment overrides teacher self-selection.
 * If admin has assigned subjects to this teacher, those are used.
 * Otherwise, teacher's self-picked list applies.
 */
export function getEffectiveSubjectIds(opts: {
  userId: string;
  fullName: string;
  teachers: Teacher[];
}): { subjectIds: string[]; source: "admin" | "self" | "none"; adminTeacher: Teacher | null } {
  const adminTeacher = findAdminTeacher(opts.teachers, opts.fullName);
  if (adminTeacher && adminTeacher.subjectIds.length > 0) {
    return { subjectIds: adminTeacher.subjectIds, source: "admin", adminTeacher };
  }
  const self = getMySubjects(opts.userId);
  if (self.length > 0) return { subjectIds: self, source: "self", adminTeacher };
  return { subjectIds: [], source: "none", adminTeacher };
}

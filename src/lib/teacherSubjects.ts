import { Teacher } from "@/types/school";

const S_KEY = (userId: string) => `teacher_subjects_${userId}`;
const C_KEY = (userId: string) => `teacher_classes_${userId}`;

export function getMySubjects(userId: string): string[] {
  try { return JSON.parse(localStorage.getItem(S_KEY(userId)) || "[]"); } catch { return []; }
}
export function setMySubjects(userId: string, subjectIds: string[]) {
  localStorage.setItem(S_KEY(userId), JSON.stringify(subjectIds));
}

export function getMyClasses(userId: string): string[] {
  try { return JSON.parse(localStorage.getItem(C_KEY(userId)) || "[]"); } catch { return []; }
}
export function setMyClasses(userId: string, classIds: string[]) {
  localStorage.setItem(C_KEY(userId), JSON.stringify(classIds));
}

/** Match a teacher record by fullName (case-insensitive, trimmed). */
export function findAdminTeacher(teachers: Teacher[], fullName: string): Teacher | null {
  const n = fullName.trim().toLowerCase();
  if (!n) return null;
  return teachers.find(t => t.name.trim().toLowerCase() === n) || null;
}

/** Union of class IDs across admin assignments. */
function adminClassIds(t: Teacher): string[] {
  const set = new Set<string>();
  t.assignments?.forEach(a => a.classIds.forEach(c => set.add(c)));
  return [...set];
}

/**
 * Admin assignment overrides teacher self-selection.
 */
export function getEffectiveSubjectIds(opts: {
  userId: string; fullName: string; teachers: Teacher[];
}): { subjectIds: string[]; source: "admin" | "self" | "none"; adminTeacher: Teacher | null } {
  const adminTeacher = findAdminTeacher(opts.teachers, opts.fullName);
  if (adminTeacher && adminTeacher.subjectIds.length > 0) {
    return { subjectIds: adminTeacher.subjectIds, source: "admin", adminTeacher };
  }
  const self = getMySubjects(opts.userId);
  if (self.length > 0) return { subjectIds: self, source: "self", adminTeacher };
  return { subjectIds: [], source: "none", adminTeacher };
}

export function getEffectiveClassIds(opts: {
  userId: string; fullName: string; teachers: Teacher[];
}): { classIds: string[]; source: "admin" | "self" | "none"; adminTeacher: Teacher | null } {
  const adminTeacher = findAdminTeacher(opts.teachers, opts.fullName);
  if (adminTeacher) {
    const ids = adminClassIds(adminTeacher);
    if (ids.length > 0) return { classIds: ids, source: "admin", adminTeacher };
  }
  const self = getMyClasses(opts.userId);
  if (self.length > 0) return { classIds: self, source: "self", adminTeacher };
  return { classIds: [], source: "none", adminTeacher };
}

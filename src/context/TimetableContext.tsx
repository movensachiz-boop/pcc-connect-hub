import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { SchoolConfig, Subject, Teacher, SchoolClass, Timetable, TimetableSlot, TimetableConflict, DayOfWeek } from '@/types/school';
import { defaultConfig, defaultSubjects, generateDefaultClasses, generateDefaultTeachers, DAYS } from '@/data/defaults';
import { v4 } from '@/lib/utils';

interface TimetableContextType {
  config: SchoolConfig;
  setConfig: (config: SchoolConfig) => void;
  subjects: Subject[];
  setSubjects: (subjects: Subject[]) => void;
  teachers: Teacher[];
  setTeachers: (teachers: Teacher[]) => void;
  classes: SchoolClass[];
  setClasses: (classes: SchoolClass[]) => void;
  timetable: Timetable | null;
  generateTimetable: () => void;
  updateSlot: (slotId: string, updates: Partial<TimetableSlot>) => void;
}

const TimetableContext = createContext<TimetableContextType | undefined>(undefined);

const loadLS = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
};

export function TimetableProvider({ children }: { children: React.ReactNode }) {
  const [config, _setConfig] = useState<SchoolConfig>(() => loadLS('tt_config', defaultConfig));
  const [subjects, _setSubjects] = useState<Subject[]>(() => loadLS('tt_subjects', defaultSubjects));
  const [teachers, _setTeachers] = useState<Teacher[]>(() => loadLS('tt_teachers', generateDefaultTeachers()));
  const [classes, _setClasses] = useState<SchoolClass[]>(() => loadLS('tt_classes', generateDefaultClasses()));
  const [timetable, setTimetable] = useState<Timetable | null>(() => loadLS<Timetable | null>('tt_timetable', null));

  const setConfig = (v: SchoolConfig) => { _setConfig(v); try { localStorage.setItem('tt_config', JSON.stringify(v)); } catch {} };
  const setSubjects = (v: Subject[]) => { _setSubjects(v); try { localStorage.setItem('tt_subjects', JSON.stringify(v)); } catch {} };
  const setTeachers = (v: Teacher[]) => { _setTeachers(v); try { localStorage.setItem('tt_teachers', JSON.stringify(v)); } catch {} };
  const setClasses = (v: SchoolClass[]) => { _setClasses(v); try { localStorage.setItem('tt_classes', JSON.stringify(v)); } catch {} };

  // Strict sync: each class's subjectIds = exactly the subjects that have a teacher
  // registered to teach that class. Subjects with no assigned teacher are removed.
  useEffect(() => {
    let changed = false;
    const next = classes.map(c => {
      const fromTeachers = new Set<string>();
      teachers.forEach(t => {
        t.assignments.forEach(a => {
          if (a.classIds.includes(c.id) && subjects.some(s => s.id === a.subjectId)) {
            fromTeachers.add(a.subjectId);
          }
        });
      });
      const replaced = [...fromTeachers];
      const same = replaced.length === c.subjectIds.length && replaced.every(id => c.subjectIds.includes(id));
      if (same) return c;
      changed = true;
      return { ...c, subjectIds: replaced };
    });
    if (changed) {
      _setClasses(next);
      try { localStorage.setItem('tt_classes', JSON.stringify(next)); } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teachers, subjects]);

  const isSportsPeriod = useCallback((day: DayOfWeek, period: number) => {
    return config.sportsDays.includes(day) && period >= config.sportsStartPeriod;
  }, [config]);

  const generateTimetable = useCallback(() => {
    const slots: TimetableSlot[] = [];
    const shuffle = <T,>(arr: T[]): T[] => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };
    const teacherSchedule: Record<string, Record<string, string>> = {};
    const teacherLoad: Record<string, number> = {};
    const classSubjectCount: Record<string, Record<string, number>> = {};
    const preAssigned: Record<string, { subjectId: string; teacherId: string }> = {};

    const totalSlots = config.periodsPerDay + 2;
    const breakSlot = config.morningBreakAfterPeriod + 1;
    const lunchSlot = config.lunchAfterPeriod + 2;

    const doubleEligible = new Set(subjects.filter(s => s.periodsPerWeek >= 5).map(s => s.id));
    const classSubjectDayDoubled: Record<string, boolean> = {};
    const dailySubjectCodes = new Set(['ENG', 'MATH']);
    const dailySubjectIds = new Set(subjects.filter(s => dailySubjectCodes.has(s.code)).map(s => s.id));
    const classSubjectDay: Record<string, Set<string>> = {};
    const classSubjectDayCount: Record<string, number> = {};
    const classSubjectDaySection: Record<string, Set<string>> = {};
    const classSubjectWeekDays: Record<string, Set<string>> = {};
    const classSubjectLastSlot: Record<string, number> = {};

    teachers.forEach(t => { teacherLoad[t.id] = 0; });

    // Auto-derive each class's subjects from teacher assignments.
    // A class only gets a subject scheduled if at least one teacher is assigned to teach
    // that subject to that class. Falls back to the class's configured subjectIds when no
    // teacher assignments exist for the class (keeps legacy behavior).
    const classSubjectIds: Record<string, string[]> = {};
    classes.forEach(c => {
      const fromTeachers = new Set<string>();
      teachers.forEach(t => {
        t.assignments.forEach(a => {
          if (a.classIds.includes(c.id) && subjects.some(s => s.id === a.subjectId)) {
            fromTeachers.add(a.subjectId);
          }
        });
      });
      classSubjectIds[c.id] = fromTeachers.size > 0 ? [...fromTeachers] : [...c.subjectIds];
      classSubjectCount[c.id] = {};
      classSubjectIds[c.id].forEach(sId => { classSubjectCount[c.id][sId] = 0; });
    });

    // Pre-mark "free periods" evenly across days so empty slots aren't clustered.
    // For each class, compute total academic slots vs. total required subject periods,
    // then reserve the difference by marking the LAST academic slot of as many days as
    // needed (rotating through days for fairness when multiple frees per day are needed).
    const freeSlots: Record<string, Set<string>> = {}; // classId -> Set("day-slot")
    classes.forEach(c => {
      freeSlots[c.id] = new Set();
      const subs = classSubjectIds[c.id]
        .map(id => subjects.find(s => s.id === id))
        .filter(Boolean) as Subject[];
      const requiredPeriods = subs.reduce((sum, s) => sum + s.periodsPerWeek, 0);
      // Build list of academic (day, slot) pairs in order
      const academicPairs: Array<{ day: DayOfWeek; slot: number }> = [];
      for (const day of DAYS) {
        for (let slot = 1; slot <= totalSlots; slot++) {
          if (slot === breakSlot || slot === lunchSlot) continue;
          if (isNonAcademic(day, slot)) continue;
          academicPairs.push({ day, slot });
        }
      }
      const totalAcademic = academicPairs.length;
      const freeNeeded = Math.max(0, totalAcademic - requiredPeriods);
      if (freeNeeded === 0) return;
      // Group by day, take from end of each day, rotate days
      const byDay: Record<string, number[]> = {};
      academicPairs.forEach(p => { (byDay[p.day] ||= []).push(p.slot); });
      Object.values(byDay).forEach(arr => arr.sort((a, b) => b - a)); // descending = last first
      let assigned = 0;
      let round = 0;
      while (assigned < freeNeeded) {
        let placedThisRound = 0;
        for (const day of DAYS) {
          if (assigned >= freeNeeded) break;
          const arr = byDay[day] || [];
          if (arr.length > round) {
            freeSlots[c.id].add(`${day}-${arr[round]}`);
            assigned++;
            placedThisRound++;
          }
        }
        if (placedThisRound === 0) break;
        round++;
      }
    });

    const isPreMarkedFree = (classId: string, day: DayOfWeek, slot: number) =>
      freeSlots[classId]?.has(`${day}-${slot}`);

    const EARLY_DAYS = new Set(['Monday', 'Tuesday', 'Wednesday']);

    const isNonAcademic = (day: DayOfWeek, s: number) => {
      if (s === breakSlot || s === lunchSlot) return true;
      let ap = 0;
      for (let i = 1; i <= s; i++) {
        if (i !== breakSlot && i !== lunchSlot) ap++;
      }
      return isSportsPeriod(day, ap);
    };

    const getDaySection = (s: number): string => {
      if (s < breakSlot) return 'before-break';
      if (s > breakSlot && s < lunchSlot) return 'after-break';
      return 'after-lunch';
    };

    const earlyDayCount = (classId: string, subjectId: string): number => {
      const key = `${classId}-${subjectId}`;
      if (!classSubjectWeekDays[key]) return 0;
      return [...classSubjectWeekDays[key]].filter(d => EARLY_DAYS.has(d)).length;
    };

    const violatesGapRule = (classId: string, day: string, subjectId: string, currentSlot: number): boolean => {
      const lastSlot = classSubjectLastSlot[`${classId}-${day}-${subjectId}`];
      if (lastSlot === undefined) return false;
      return currentSlot - lastSlot === 2;
    };

    const isConsecutive = (classId: string, day: string, subjectId: string, currentSlot: number): boolean => {
      const lastSlot = classSubjectLastSlot[`${classId}-${day}-${subjectId}`];
      return lastSlot !== undefined && currentSlot - lastSlot === 1;
    };

    const recordSubjectSlot = (
      classId: string, day: DayOfWeek, subjectId: string, slot: number,
      teacherId?: string, teacher?: Teacher
    ) => {
      classSubjectCount[classId][subjectId] = (classSubjectCount[classId][subjectId] || 0) + 1;
      const classDayKey = `${classId}-${day}`;
      if (!classSubjectDay[classDayKey]) classSubjectDay[classDayKey] = new Set();
      classSubjectDay[classDayKey].add(subjectId);
      classSubjectDayCount[`${classId}-${day}-${subjectId}`] = (classSubjectDayCount[`${classId}-${day}-${subjectId}`] || 0) + 1;
      const sectionKey = `${classId}-${day}-${subjectId}`;
      if (!classSubjectDaySection[sectionKey]) classSubjectDaySection[sectionKey] = new Set();
      classSubjectDaySection[sectionKey].add(getDaySection(slot));
      classSubjectLastSlot[`${classId}-${day}-${subjectId}`] = slot;
      const weekKey = `${classId}-${subjectId}`;
      if (!classSubjectWeekDays[weekKey]) classSubjectWeekDays[weekKey] = new Set();
      classSubjectWeekDays[weekKey].add(day);
      if (teacherId && teacher) {
        if (!teacherSchedule[teacherId]) teacherSchedule[teacherId] = {};
        teacherSchedule[teacherId][`${day}-${slot}`] = classId;
        teacherLoad[teacherId] = (teacherLoad[teacherId] || 0) + 1;
      }
    };

    for (const day of DAYS) {
      let academicPeriod = 0;
      for (let slot = 1; slot <= totalSlots; slot++) {
        if (slot === breakSlot) {
          classes.forEach(c => { slots.push({ id: v4(), day, period: slot, classId: c.id, type: 'break' }); });
          continue;
        }
        if (slot === lunchSlot) {
          classes.forEach(c => { slots.push({ id: v4(), day, period: slot, classId: c.id, type: 'lunch' }); });
          continue;
        }
        academicPeriod++;
        if (isSportsPeriod(day, academicPeriod)) {
          classes.forEach(c => { slots.push({ id: v4(), day, period: slot, classId: c.id, type: 'sports' }); });
          continue;
        }

        const shuffledClasses = shuffle(classes);
        for (const cls of shuffledClasses) {
          const preKey = `${cls.id}-${day}-${slot}`;
          if (preAssigned[preKey]) {
            const pa = preAssigned[preKey];
            slots.push({ id: v4(), day, period: slot, classId: cls.id, subjectId: pa.subjectId, teacherId: pa.teacherId, type: 'lesson' });
            const t = teachers.find(t => t.id === pa.teacherId);
            recordSubjectSlot(cls.id, day, pa.subjectId, slot, pa.teacherId, t);
            continue;
          }

          const classDayKey = `${cls.id}-${day}`;
          if (!classSubjectDay[classDayKey]) classSubjectDay[classDayKey] = new Set();
          const scheduledToday = classSubjectDay[classDayKey];
          const currentSection = getDaySection(slot);
          const isEarlyDay = EARLY_DAYS.has(day);

          const availableSubjects = shuffle(
            (classSubjectIds[cls.id] || cls.subjectIds)
              .map(sId => subjects.find(s => s.id === sId)!)
              .filter(s => s && (classSubjectCount[cls.id][s.id] || 0) < s.periodsPerWeek)
          )
            .filter(s => {
              const dayCount = classSubjectDayCount[`${cls.id}-${day}-${s.id}`] || 0;
              if (dayCount >= 2) return false;
              if (dayCount === 1) return isConsecutive(cls.id, day, s.id, slot);
              return true;
            })
            .filter(s => {
              if (s.isCompulsory || dailySubjectIds.has(s.id)) return true;
              return !violatesGapRule(cls.id, day, s.id, slot);
            })
            .sort((a, b) => {
              const aDailyNeeded = dailySubjectIds.has(a.id) && !scheduledToday.has(a.id) ? 0 : 1;
              const bDailyNeeded = dailySubjectIds.has(b.id) && !scheduledToday.has(b.id) ? 0 : 1;
              if (aDailyNeeded !== bDailyNeeded) return aDailyNeeded - bDailyNeeded;
              const aToday = scheduledToday.has(a.id) ? 1 : 0;
              const bToday = scheduledToday.has(b.id) ? 1 : 0;
              if (aToday !== bToday) return aToday - bToday;
              if (!a.isCompulsory && !b.isCompulsory && isEarlyDay) {
                const aEarly = earlyDayCount(cls.id, a.id);
                const bEarly = earlyDayCount(cls.id, b.id);
                if (aEarly !== bEarly) return aEarly - bEarly;
              }
              const aDays = classSubjectWeekDays[`${cls.id}-${a.id}`]?.size || 0;
              const bDays = classSubjectWeekDays[`${cls.id}-${b.id}`]?.size || 0;
              if (aDays !== bDays) return aDays - bDays;
              const aSectionKey = `${cls.id}-${day}-${a.id}`;
              const bSectionKey = `${cls.id}-${day}-${b.id}`;
              const aInSection = classSubjectDaySection[aSectionKey]?.has(currentSection) ? 1 : 0;
              const bInSection = classSubjectDaySection[bSectionKey]?.has(currentSection) ? 1 : 0;
              if (aInSection !== bInSection) return aInSection - bInSection;
              const aCore = a.isCompulsory ? 0 : 1;
              const bCore = b.isCompulsory ? 0 : 1;
              if (aCore !== bCore) return aCore - bCore;
              const aRemain = a.periodsPerWeek - (classSubjectCount[cls.id][a.id] || 0);
              const bRemain = b.periodsPerWeek - (classSubjectCount[cls.id][b.id] || 0);
              return bRemain - aRemain;
            });

          let assigned = false;
          for (const subject of availableSubjects) {
            const availableTeachers = teachers.filter(t => {
              const hasAssignment = t.assignments.some(a => a.subjectId === subject.id && a.classIds.includes(cls.id));
              return hasAssignment && (teacherLoad[t.id] || 0) < t.maxPeriodsPerWeek && !teacherSchedule[t.id]?.[`${day}-${slot}`];
            });

            if (availableTeachers.length > 0) {
              const teacher = availableTeachers.sort((a, b) => (teacherLoad[a.id] || 0) - (teacherLoad[b.id] || 0))[0];
              slots.push({ id: v4(), day, period: slot, classId: cls.id, subjectId: subject.id, teacherId: teacher.id, type: 'lesson' });
              recordSubjectSlot(cls.id, day, subject.id, slot, teacher.id, teacher);
              assigned = true;

              const nextSlot = slot + 1;
              const doubleKey = `${cls.id}-${subject.id}-${day}`;
              const alreadyTodayCount = classSubjectDayCount[`${cls.id}-${day}-${subject.id}`] || 0;
              if (
                doubleEligible.has(subject.id) && !classSubjectDayDoubled[doubleKey] &&
                alreadyTodayCount < 2 && nextSlot <= totalSlots &&
                !isNonAcademic(day, nextSlot) && !preAssigned[`${cls.id}-${day}-${nextSlot}`] &&
                (classSubjectCount[cls.id][subject.id] || 0) < subject.periodsPerWeek &&
                !teacherSchedule[teacher.id]?.[`${day}-${nextSlot}`] &&
                (teacherLoad[teacher.id] || 0) < teacher.maxPeriodsPerWeek
              ) {
                preAssigned[`${cls.id}-${day}-${nextSlot}`] = { subjectId: subject.id, teacherId: teacher.id };
                if (!teacherSchedule[teacher.id]) teacherSchedule[teacher.id] = {};
                teacherSchedule[teacher.id][`${day}-${nextSlot}`] = cls.id;
                classSubjectDayDoubled[doubleKey] = true;
              }
              break;
            }
          }

          if (!assigned && availableSubjects.length > 0) {
            const subject = availableSubjects[0];
            slots.push({ id: v4(), day, period: slot, classId: cls.id, subjectId: subject.id, type: 'lesson' });
            recordSubjectSlot(cls.id, day, subject.id, slot);
            assigned = true;
          }
          if (!assigned) {
            slots.push({ id: v4(), day, period: slot, classId: cls.id, type: 'lesson' });
          }
        }
      }
    }

    const newTimetable: Timetable = { id: v4(), slots, conflicts: [], generatedAt: new Date().toISOString() };
    newTimetable.conflicts = detectConflicts(slots);
    setTimetable(newTimetable);
  }, [config, subjects, teachers, classes, isSportsPeriod]);

  const detectConflicts = (slots: TimetableSlot[]): TimetableConflict[] => {
    const conflicts: TimetableConflict[] = [];
    const lessonSlots = slots.filter(s => s.type === 'lesson' && s.teacherId);
    const teacherMap: Record<string, TimetableSlot[]> = {};
    lessonSlots.forEach(s => {
      const key = `${s.teacherId}-${s.day}-${s.period}`;
      if (!teacherMap[key]) teacherMap[key] = [];
      teacherMap[key].push(s);
    });
    Object.entries(teacherMap).forEach(([_, slotGroup]) => {
      if (slotGroup.length > 1) {
        const teacher = teachers.find(t => t.id === slotGroup[0].teacherId);
        conflicts.push({
          type: 'teacher-clash',
          message: `${teacher?.name || 'Unknown'} is double-booked on ${slotGroup[0].day} period ${slotGroup[0].period}`,
          slots: slotGroup.map(s => s.id),
        });
      }
    });
    return conflicts;
  };

  const updateSlot = useCallback((slotId: string, updates: Partial<TimetableSlot>) => {
    if (!timetable) return;
    const newSlots = timetable.slots.map(s => s.id === slotId ? { ...s, ...updates } : s);
    setTimetable({ ...timetable, slots: newSlots, conflicts: detectConflicts(newSlots) });
  }, [timetable, teachers]);

  return (
    <TimetableContext.Provider value={{
      config, setConfig, subjects, setSubjects, teachers, setTeachers,
      classes, setClasses, timetable, generateTimetable, updateSlot,
    }}>
      {children}
    </TimetableContext.Provider>
  );
}

export function useTimetable() {
  const ctx = useContext(TimetableContext);
  if (!ctx) throw new Error('useTimetable must be used within TimetableProvider');
  return ctx;
}

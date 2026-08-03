(function exposePlannerCore(globalScope) {
  "use strict";

  const DAY_NUMBERS = Object.freeze({
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    日: 7,
    天: 7,
  });

  function createSemesterId(academicYear, term) {
    const normalizedYear = String(academicYear ?? "").trim();
    const normalizedTerm = String(term ?? "").trim();
    if (!/^\d{2,3}$/.test(normalizedYear)) {
      throw new Error("學年度必須是 2 至 3 位數字");
    }
    if (!/^[12]$/.test(normalizedTerm)) {
      throw new Error("學期只能是 1 或 2");
    }
    return `${normalizedYear}-${normalizedTerm}`;
  }

  function createCourseId(course) {
    const semesterId = createSemesterId(course.academicYear, course.term);
    const identity = String(
      course.courseCode || course.serialNumber || course.name || ""
    )
      .trim()
      .toUpperCase();
    if (!identity) throw new Error("課程缺少可辨識的編號或名稱");
    return `${semesterId}:${identity}`;
  }

  function isSameCourse(firstCourse, secondCourse) {
    const firstSemester = createSemesterId(
      firstCourse.academicYear,
      firstCourse.term
    );
    const secondSemester = createSemesterId(
      secondCourse.academicYear,
      secondCourse.term
    );
    if (firstSemester !== secondSemester) return false;

    const firstCode = String(firstCourse.courseCode || "").trim().toUpperCase();
    const secondCode = String(secondCourse.courseCode || "").trim().toUpperCase();
    if (firstCode && secondCode) return firstCode === secondCode;
    return createCourseId(firstCourse) === createCourseId(secondCourse);
  }

  function normalizeCourse(course) {
    return {
      id: createCourseId(course),
      academicYear: String(course.academicYear).trim(),
      term: String(course.term).trim(),
      serialNumber: String(course.serialNumber || "").trim(),
      courseCode: String(course.courseCode || "").trim(),
      name: String(course.name || "").trim(),
      teacher: String(course.teacher || "").trim(),
      credits: String(course.credits || "").trim(),
      timePlace: String(course.timePlace || "").trim(),
      owner: String(course.owner || "").trim(),
      detailUrl: String(course.detailUrl || "").trim(),
    };
  }

  function addCourse(schedule, course) {
    const normalizedCourse = normalizeCourse(course);
    const semesterId = createSemesterId(course.academicYear, course.term);
    const currentCourses = Array.isArray(schedule?.[semesterId])
      ? schedule[semesterId]
      : [];
    const existingIndex = currentCourses.findIndex((item) =>
      isSameCourse(item, normalizedCourse)
    );
    if (existingIndex >= 0) {
      return {
        ...schedule,
        [semesterId]: currentCourses.map((item, index) =>
          index === existingIndex ? normalizedCourse : item
        ),
      };
    }
    return {
      ...schedule,
      [semesterId]: [...currentCourses, normalizedCourse],
    };
  }

  function removeCourse(schedule, semesterId, courseId) {
    const currentCourses = Array.isArray(schedule?.[semesterId])
      ? schedule[semesterId]
      : [];
    return {
      ...schedule,
      [semesterId]: currentCourses.filter((course) => course.id !== courseId),
    };
  }

  function expandPeriods(first, last) {
    const start = Number(first);
    const end = Number(last || first);
    if (!Number.isInteger(start) || !Number.isInteger(end) || end < start) {
      return [String(first)];
    }
    return Array.from({ length: end - start + 1 }, (_, index) =>
      String(start + index)
    );
  }

  function parseMeetingSlots(timePlace) {
    const rawLines = String(timePlace || "")
      .split(/\n|；|;/)
      .map((line) => line.trim())
      .filter(Boolean);
    const lines = rawLines.reduce((meetings, line) => {
      const startsWithDay = /^(?:每週|星期|週|周)?\s*[一二三四五六日天]/.test(line);
      if (startsWithDay || meetings.length === 0) {
        meetings.push(line);
        return meetings;
      }
      meetings[meetings.length - 1] += ` ${line}`;
      return meetings;
    }, []);
    return lines.flatMap((line) => {
      const match = line.match(
        /^(?:每週|星期|週|周)?\s*([一二三四五六日天])\s*(?:第)?\s*(\d+)(?:\s*[-~～至]\s*(\d+))?\s*(?:節)?\s*(.*)$/
      );
      if (!match) return [];
      const [, dayLabel, firstPeriod, lastPeriod, rawLocation] = match;
      const location = rawLocation.trim();
      return expandPeriods(firstPeriod, lastPeriod).map((period) => ({
        day: DAY_NUMBERS[dayLabel],
        period,
        location,
      }));
    });
  }

  const plannerCore = Object.freeze({
    addCourse,
    createCourseId,
    createSemesterId,
    isSameCourse,
    parseMeetingSlots,
    removeCourse,
  });

  globalScope.NTPUPlannerCore = plannerCore;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = plannerCore;
  }
})(typeof globalThis === "undefined" ? window : globalThis);

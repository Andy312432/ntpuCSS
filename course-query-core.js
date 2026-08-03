(function exposeCourseQueryCore(globalScope) {
  "use strict";

  function text(value) {
    return String(value ?? "").trim();
  }

  function optionalNumber(value) {
    const normalized = text(value).replace(/,/g, "");
    if (!normalized || normalized === "-") return null;
    const number = Number(normalized);
    return Number.isFinite(number) ? number : null;
  }

  function scheduleQueryBody(filters, allowEighteenWeeks = true) {
    return {
      qYear: text(filters.academicYear),
      qTerm: text(filters.term),
      week: text(filters.weekday),
      seq1: text(filters.startPeriod) || "A",
      seq2: text(filters.endPeriod) || "M",
      ...(filters.onlyRestricted ? { lm_check: "1" } : {}),
      ...(allowEighteenWeeks && filters.onlyEighteenWeeks ? { w18_check: "1" } : {}),
    };
  }

  function sharedQueryBody(filters) {
    return { ...scheduleQueryBody(filters), cour: "", teach: "" };
  }

  function buildCourseQuery(filters) {
    const sharedBody = sharedQueryBody(filters);
    const queryMode = text(filters.queryMode) || "all";
    const courseKeyword = text(filters.courseKeyword);
    const isCourseCode = /^[A-Za-z]{1,3}\d{3,5}$/.test(courseKeyword);
    if (queryMode === "all" && isCourseCode) {
      return {
        type: "keyword",
        body: { ...sharedBody, courseno: courseKeyword },
        clientFilters: {},
      };
    }
    const clientFilters = { courseKeyword };
    if (queryMode === "required") {
      return {
        type: "required",
        body: {
          ...scheduleQueryBody(filters),
          qCollege: text(filters.college),
          qDept: text(filters.department),
          qkind: text(filters.requirementKind) || "必選修",
          qGrade: text(filters.grade),
          qClass: text(filters.className),
        },
        clientFilters,
      };
    }
    if (queryMode === "language") {
      return {
        type: "language",
        body: {
          ...scheduleQueryBody(filters),
          lang: text(filters.language) || "1",
          lang_check: "1",
        },
        clientFilters,
      };
    }
    if (queryMode === "general") {
      return {
        type: "general",
        body: {
          ...scheduleQueryBody(filters),
          qDept: text(filters.generalCategory) || "GU18",
          qGroup: text(filters.generalGroup),
        },
        clientFilters,
      };
    }
    if (queryMode === "physical") {
      return {
        type: "physical",
        body: {
          ...scheduleQueryBody(filters),
          qDept: text(filters.physicalEducation) || "GU20",
        },
        clientFilters,
      };
    }
    if (queryMode === "summer") {
      return {
        type: "summer",
        body: scheduleQueryBody(filters, false),
        clientFilters,
      };
    }
    return {
      type: "conditions",
      body: {
        ...sharedBody,
        qEdu: text(filters.education),
        qCollege: text(filters.college),
        qdept: text(filters.department),
        qGrade: text(filters.grade),
        qClass: text(filters.className),
        qMemo: "",
      },
      clientFilters,
    };
  }

  function pairCourseRequirements(requiredItems = [], requirementTypes = []) {
    return requiredItems.map((item, index) => ({
      label: text(item?.label),
      type: text(requirementTypes[index]),
      url: text(item?.url),
    }));
  }

  function normalizeCourseCells(cells, details = {}) {
    const capacity = optionalNumber(cells[16]);
    const selected = optionalNumber(cells[17]);
    const approved = optionalNumber(cells[18]);
    const occupiedSeats = approved ?? selected;
    const availableSeats =
      capacity === null || occupiedSeats === null
        ? null
        : Math.max(capacity - occupiedSeats, 0);
    const requirements = Array.isArray(details.requirements)
      ? details.requirements.map((item) => ({
          label: text(item.label),
          type: text(item.type),
          url: text(item.url),
        }))
      : [];
    const prerequisites = Array.isArray(details.prerequisites)
      ? details.prerequisites
      : requirements.filter((item) => item.url);
    return {
      academicYear: text(cells[1]),
      term: text(cells[2]),
      serialNumber: text(cells[0]).replace(/\.$/, ""),
      courseCode: text(cells[3]),
      owner: text(cells[4]),
      requiredFor: text(cells[5]),
      requirementType: text(cells[6]),
      name: text(details.name),
      englishName: text(details.englishName),
      notes: text(details.notes),
      detailUrl: text(details.detailUrl),
      restrictionUrl: text(details.restrictionUrl),
      restrictionLabel: text(details.restrictionLabel),
      requirements,
      prerequisites: prerequisites.map((item) => ({
            label: text(item.label),
            url: text(item.url),
          })),
      teacher: text(cells[8]),
      courseType: text(cells[9]),
      credits: text(cells[10]),
      hours: text(cells[11]),
      language: text(cells[12]),
      timePlace: text(cells[13]),
      canAddWithApproval: text(cells[14]) === "是",
      approvalLimit: optionalNumber(cells[15]),
      capacity,
      selected,
      approved,
      pending: optionalNumber(cells[19]),
      availableSeats,
    };
  }

  function normalizedSearchText(value) {
    return text(value)
      .normalize("NFKC")
      .toLocaleLowerCase("zh-Hant")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function editDistance(first, second) {
    const previous = Array.from({ length: second.length + 1 }, (_, index) => index);
    for (let firstIndex = 1; firstIndex <= first.length; firstIndex += 1) {
      const current = [firstIndex];
      for (let secondIndex = 1; secondIndex <= second.length; secondIndex += 1) {
        const substitutionCost = first[firstIndex - 1] === second[secondIndex - 1] ? 0 : 1;
        current[secondIndex] = Math.min(
          current[secondIndex - 1] + 1,
          previous[secondIndex] + 1,
          previous[secondIndex - 1] + substitutionCost
        );
      }
      previous.splice(0, previous.length, ...current);
    }
    return previous[second.length];
  }

  function isSubsequence(candidate, query) {
    let queryIndex = 0;
    for (const character of candidate) {
      if (character === query[queryIndex]) queryIndex += 1;
      if (queryIndex === query.length) return true;
    }
    return false;
  }

  function fuzzyMatch(value, query) {
    const candidate = normalizedSearchText(value);
    const keyword = normalizedSearchText(query);
    if (!keyword) return true;
    if (candidate.includes(keyword)) return true;
    if (keyword.length < 2) return false;
    const compactCandidate = candidate.replace(/\s/g, "").slice(0, 600);
    const compactKeyword = keyword.replace(/\s/g, "");
    if (isSubsequence(compactCandidate, compactKeyword)) return true;

    const threshold = compactKeyword.length <= 4 ? 1 : Math.ceil(compactKeyword.length * 0.2);
    const minimumLength = Math.max(1, compactKeyword.length - threshold);
    const maximumLength = compactKeyword.length + threshold;
    for (let length = minimumLength; length <= maximumLength; length += 1) {
      for (let start = 0; start + length <= compactCandidate.length; start += 1) {
        const window = compactCandidate.slice(start, start + length);
        if (editDistance(window, compactKeyword) <= threshold) return true;
      }
    }
    return false;
  }

  function matchesSearch(course, searchText) {
    const tokens = normalizedSearchText(searchText).split(" ").filter(Boolean);
    if (!tokens.length) return true;
    const fields = [
      course.name,
      course.englishName,
      course.courseCode,
      course.teacher,
      course.owner,
      course.notes,
    ];
    return tokens.every((token) => fields.some((field) => fuzzyMatch(field, token)));
  }

  function matchesAvailability(course, availability) {
    if (availability === "available") return course.availableSeats > 0;
    if (availability === "approval") return course.canAddWithApproval;
    return true;
  }

  function compareCourses(first, second, sortBy) {
    if (sortBy === "availability") {
      return (second.availableSeats ?? -1) - (first.availableSeats ?? -1);
    }
    if (sortBy === "credits") {
      return Number(second.credits || 0) - Number(first.credits || 0);
    }
    const field = sortBy === "name" ? "name" : "courseCode";
    return text(first[field]).localeCompare(text(second[field]), "zh-Hant");
  }

  function filterAndSortCourses(courses, filters = {}) {
    return courses
      .filter((course) => matchesSearch(course, filters.searchText))
      .filter((course) => matchesSearch(course, filters.courseKeyword))
      .filter((course) => matchesAvailability(course, filters.availability))
      .sort((first, second) => compareCourses(first, second, filters.sortBy));
  }

  const courseQueryCore = Object.freeze({
    buildCourseQuery,
    filterAndSortCourses,
    fuzzyMatch,
    normalizeCourseCells,
    pairCourseRequirements,
  });

  globalScope.NTPUCourseQueryCore = courseQueryCore;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = courseQueryCore;
  }
})(typeof globalThis === "undefined" ? window : globalThis);

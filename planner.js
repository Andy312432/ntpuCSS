(function initializePlanner() {
  "use strict";

  const PERIODS = Array.from({ length: 13 }, (_, index) => String(index + 1));
  const form = document.querySelector("#semesterForm");
  const yearInput = document.querySelector("#academicYear");
  const termSelect = document.querySelector("#term");
  const semesterSummary = document.querySelector("#semesterSummary");
  const conflictSummary = document.querySelector("#conflictSummary");
  const timetableBody = document.querySelector("#timetableBody");
  const courseListBody = document.querySelector("#courseListBody");
  const courseTableWrapper = document.querySelector("#courseTableWrapper");
  const emptyState = document.querySelector("#emptyState");

  function estimatedCurrentSemester() {
    const today = new Date();
    const academicYear = today.getFullYear() - 1911 - (today.getMonth() < 7 ? 1 : 0);
    const term = today.getMonth() >= 1 && today.getMonth() < 7 ? "2" : "1";
    return `${academicYear}-${term}`;
  }

  function selectedSemesterId() {
    return NTPUPlannerCore.createSemesterId(yearInput.value, termSelect.value);
  }

  function setSemesterFields(semesterId) {
    const [academicYear, term] = semesterId.split("-");
    yearInput.value = academicYear;
    termSelect.value = term;
  }

  function createTextCell(text) {
    const cell = document.createElement("td");
    cell.textContent = text || "—";
    return cell;
  }

  function buildSlotMap(courses) {
    const slots = new Map();
    courses.forEach((course) => {
      NTPUPlannerCore.parseMeetingSlots(course.timePlace).forEach((meeting) => {
        const key = `${meeting.day}-${meeting.period}`;
        const entries = slots.get(key) || [];
        entries.push({ course, location: meeting.location });
        slots.set(key, entries);
      });
    });
    return slots;
  }

  function renderTimetable(courses) {
    const slots = buildSlotMap(courses);
    timetableBody.replaceChildren();
    let conflictCount = 0;

    PERIODS.forEach((period) => {
      const row = document.createElement("tr");
      const periodHeader = document.createElement("th");
      periodHeader.scope = "row";
      periodHeader.textContent = period;
      row.appendChild(periodHeader);

      for (let day = 1; day <= 7; day += 1) {
        const cell = document.createElement("td");
        const entries = slots.get(`${day}-${period}`) || [];
        if (entries.length > 1) {
          cell.classList.add("has-conflict");
          conflictCount += 1;
        }
        entries.forEach(({ course, location }) => {
          const item = document.createElement("div");
          item.className = "timetable-course";
          const name = document.createElement("strong");
          name.textContent = course.name;
          const place = document.createElement("span");
          place.textContent = location || "地點未標示";
          item.append(name, place);
          cell.appendChild(item);
        });
        row.appendChild(cell);
      }
      timetableBody.appendChild(row);
    });

    conflictSummary.textContent = conflictCount
      ? `有 ${conflictCount} 個時段衝堂`
      : "未發現可辨識的衝堂";
    conflictSummary.classList.toggle("has-conflict", conflictCount > 0);
  }

  function createCourseNameCell(course) {
    const cell = document.createElement("td");
    if (!course.detailUrl) {
      cell.textContent = course.name || "—";
      return cell;
    }
    const link = document.createElement("a");
    link.href = course.detailUrl;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = course.name || "—";
    cell.appendChild(link);
    return cell;
  }

  function createRemoveCell(course, semesterId) {
    const cell = document.createElement("td");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "remove-button";
    button.textContent = "刪除";
    button.setAttribute("aria-label", `從試排課刪除 ${course.name}`);
    button.addEventListener("click", async () => {
      button.disabled = true;
      await NTPUPlannerStorage.removeCourse(semesterId, course.id);
      await renderSemester(semesterId);
    });
    cell.appendChild(button);
    return cell;
  }

  function renderCourseList(courses, semesterId) {
    courseListBody.replaceChildren();
    courses.forEach((course) => {
      const row = document.createElement("tr");
      row.append(
        createTextCell(course.courseCode),
        createCourseNameCell(course),
        createTextCell(course.teacher),
        createTextCell(course.credits),
        createTextCell(course.timePlace),
        createRemoveCell(course, semesterId)
      );
      courseListBody.appendChild(row);
    });
    emptyState.hidden = courses.length > 0;
    courseTableWrapper.hidden = courses.length === 0;
  }

  async function renderSemester(semesterId) {
    const schedules = await NTPUPlannerStorage.loadSchedules();
    const courses = schedules[semesterId] || [];
    semesterSummary.textContent = `${semesterId}，共 ${courses.length} 門試排課程`;
    renderTimetable(courses);
    renderCourseList(courses, semesterId);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const semesterId = selectedSemesterId();
    await NTPUPlannerStorage.setActiveSemester(semesterId);
    await renderSemester(semesterId);
  });

  Promise.all([
    NTPUPlannerStorage.getActiveSemester(),
    NTPUPlannerStorage.loadSchedules(),
  ])
    .then(([activeSemester, schedules]) => {
      const savedSemesters = Object.keys(schedules).sort().reverse();
      const semesterId = activeSemester || savedSemesters[0] || estimatedCurrentSemester();
      setSemesterFields(semesterId);
      return renderSemester(semesterId);
    })
    .catch((error) => {
      semesterSummary.textContent = `無法讀取試排課：${error.message}`;
    });
})();

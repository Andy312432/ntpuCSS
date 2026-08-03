(function initializePopup() {
  "use strict";

  const form = document.querySelector("#semesterForm");
  const yearInput = document.querySelector("#academicYear");
  const termSelect = document.querySelector("#term");
  const summary = document.querySelector("#summary");
  const viewButton = document.querySelector("#viewPlanner");
  const searchButton = document.querySelector("#openSearch");

  function estimatedCurrentSemester() {
    const today = new Date();
    const academicYear = today.getFullYear() - 1911 - (today.getMonth() < 7 ? 1 : 0);
    const term = today.getMonth() >= 1 && today.getMonth() < 7 ? "2" : "1";
    return `${academicYear}-${term}`;
  }

  function setSemesterFields(semesterId) {
    const [academicYear, term] = semesterId.split("-");
    yearInput.value = academicYear;
    termSelect.value = term;
  }

  function selectedSemesterId() {
    return NTPUPlannerCore.createSemesterId(yearInput.value, termSelect.value);
  }

  async function updateSummary() {
    const semesterId = selectedSemesterId();
    const schedules = await NTPUPlannerStorage.loadSchedules();
    const count = (schedules[semesterId] || []).length;
    summary.textContent = `${semesterId}：目前已選 ${count} 門課`;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const semesterId = selectedSemesterId();
      await NTPUPlannerStorage.setActiveSemester(semesterId);
      await updateSummary();
    } catch (error) {
      summary.textContent = error.message;
    }
  });

  viewButton.addEventListener("click", async () => {
    try {
      await NTPUPlannerStorage.setActiveSemester(selectedSemesterId());
      await chrome.tabs.create({ url: chrome.runtime.getURL("planner.html") });
    } catch (error) {
      summary.textContent = error.message;
    }
  });

  searchButton.addEventListener("click", async () => {
    await chrome.tabs.create({ url: chrome.runtime.getURL("search.html") });
  });

  Promise.all([
    NTPUPlannerStorage.getActiveSemester(),
    NTPUPlannerStorage.loadSchedules(),
  ])
    .then(([activeSemester, schedules]) => {
      const savedSemesters = Object.keys(schedules).sort().reverse();
      setSemesterFields(activeSemester || savedSemesters[0] || estimatedCurrentSemester());
      return updateSummary();
    })
    .catch((error) => {
      summary.textContent = `無法讀取試排課：${error.message}`;
    });
})();

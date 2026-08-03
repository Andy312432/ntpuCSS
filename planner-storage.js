(function exposePlannerStorage(globalScope) {
  "use strict";

  const SCHEDULE_KEY = "ntpuTrialSchedules";
  const ACTIVE_SEMESTER_KEY = "ntpuTrialActiveSemester";
  let mutationQueue = Promise.resolve();

  function getStorage(values) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(values, (result) => {
        const error = chrome.runtime.lastError;
        if (error) reject(error);
        else resolve(result);
      });
    });
  }

  function setStorage(values) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(values, () => {
        const error = chrome.runtime.lastError;
        if (error) reject(error);
        else resolve();
      });
    });
  }

  async function loadSchedules() {
    const result = await getStorage({ [SCHEDULE_KEY]: {} });
    const schedules = result[SCHEDULE_KEY];
    return schedules && typeof schedules === "object" ? schedules : {};
  }

  function enqueueMutation(mutation) {
    const result = mutationQueue.then(mutation, mutation);
    mutationQueue = result.catch(() => undefined);
    return result;
  }

  function addCourse(course) {
    return enqueueMutation(async () => {
      const schedules = await loadSchedules();
      const updated = globalScope.NTPUPlannerCore.addCourse(schedules, course);
      const semesterId = globalScope.NTPUPlannerCore.createSemesterId(
        course.academicYear,
        course.term
      );
      await setStorage({
        [SCHEDULE_KEY]: updated,
        [ACTIVE_SEMESTER_KEY]: semesterId,
      });
      return updated[semesterId];
    });
  }

  function removeCourse(semesterId, courseId) {
    return enqueueMutation(async () => {
      const schedules = await loadSchedules();
      const updated = globalScope.NTPUPlannerCore.removeCourse(
        schedules,
        semesterId,
        courseId
      );
      await setStorage({ [SCHEDULE_KEY]: updated });
      return updated[semesterId];
    });
  }

  async function getActiveSemester() {
    const result = await getStorage({ [ACTIVE_SEMESTER_KEY]: "" });
    return String(result[ACTIVE_SEMESTER_KEY] || "");
  }

  async function setActiveSemester(semesterId) {
    const [academicYear, term] = String(semesterId).split("-");
    globalScope.NTPUPlannerCore.createSemesterId(academicYear, term);
    await setStorage({ [ACTIVE_SEMESTER_KEY]: semesterId });
  }

  globalScope.NTPUPlannerStorage = Object.freeze({
    addCourse,
    getActiveSemester,
    loadSchedules,
    removeCourse,
    setActiveSemester,
  });
})(typeof globalThis === "undefined" ? window : globalThis);

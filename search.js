(function initializeCourseSearch() {
  "use strict";

  const OFFICIAL_BASE = "https://sea.cc.ntpu.edu.tw/pls/dev_stud/";
  const FILTERS_KEY = "ntpuCourseSearchFilters";
  const PERIOD_CODES = "ABCDEFGHIJKLM".split("");
  const state = {
    courses: [],
    clientFilters: {},
    departments: [],
    officialCount: 0,
  };

  const form = document.querySelector("#queryForm");
  const submitButton = document.querySelector("#submitQuery");
  const resetButton = document.querySelector("#resetQuery");
  const yearSelect = document.querySelector("#academicYear");
  const collegeSelect = document.querySelector("#college");
  const departmentSelect = document.querySelector("#department");
  const resultSummary = document.querySelector("#resultSummary");
  const resultTools = document.querySelector("#resultTools");
  const statusBox = document.querySelector("#statusBox");
  const courseResults = document.querySelector("#courseResults");
  const searchTextInput = document.querySelector("#searchText");
  const availabilitySelect = document.querySelector("#availability");
  const sortSelect = document.querySelector("#sortBy");
  const queryModeSelect = document.querySelector("#queryMode");
  const officialQueryBridge = document.querySelector("#officialQueryBridge");
  let loadedOfficialForm = "";

  function sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        const error = chrome.runtime.lastError;
        if (error) reject(error);
        else if (!response?.ok) reject(new Error(response?.error || "外掛沒有收到回應"));
        else resolve(response);
      });
    });
  }

  function loadOfficialForm(url) {
    if (loadedOfficialForm === url) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("北大官方查詢頁載入逾時")), 15000);
      officialQueryBridge.addEventListener(
        "load",
        () => {
          clearTimeout(timeout);
          loadedOfficialForm = url;
          resolve();
        },
        { once: true }
      );
      officialQueryBridge.src = url;
    });
  }

  async function queryThroughOfficialPage(query) {
    const formUrl = NTPUCourseQueryTransport.officialFormUrl(query.type);
    await loadOfficialForm(formUrl);
    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        window.removeEventListener("message", receiveResult);
        reject(new Error("北大課程查詢逾時"));
      }, 30000);
      function receiveResult(event) {
        const response = event.data;
        if (event.source !== officialQueryBridge.contentWindow) return;
        if (response?.type !== "ntpu-official-course-query-result") return;
        if (response.extensionId !== chrome.runtime.id || response.requestId !== requestId) return;
        clearTimeout(timeout);
        window.removeEventListener("message", receiveResult);
        if (response.ok) resolve(response);
        else reject(new Error(response.error || "北大官方查詢失敗"));
      }
      window.addEventListener("message", receiveResult);
      officialQueryBridge.contentWindow.postMessage(
        {
          type: "ntpu-official-course-query",
          extensionId: chrome.runtime.id,
          requestId,
          query,
        },
        new URL(formUrl).origin
      );
    });
  }

  function storageGet(defaults) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(defaults, (result) => {
        const error = chrome.runtime.lastError;
        if (error) reject(error);
        else resolve(result);
      });
    });
  }

  function storageSet(values) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(values, () => {
        const error = chrome.runtime.lastError;
        if (error) reject(error);
        else resolve();
      });
    });
  }

  function replaceOptions(select, options, emptyLabel) {
    select.replaceChildren();
    if (emptyLabel) {
      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = emptyLabel;
      select.appendChild(emptyOption);
    }
    options.forEach(({ value, label }) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    });
  }

  function populatePeriods() {
    const options = PERIOD_CODES.map((value, index) => ({
      value,
      label: `第 ${index + 1} 節`,
    }));
    replaceOptions(document.querySelector("#startPeriod"), options);
    replaceOptions(document.querySelector("#endPeriod"), options);
    document.querySelector("#startPeriod").value = "A";
    document.querySelector("#endPeriod").value = "M";
  }

  function parseOfficialOptions(html) {
    const documentNode = new DOMParser().parseFromString(html, "text/html");
    const years = Array.from(documentNode.querySelectorAll('select[name="qYear"] option'))
      .map((option) => ({ value: option.value.trim(), label: option.textContent.trim() }))
      .filter((option) => option.value);
    const colleges = Array.from(
      documentNode.querySelectorAll('select[name="qCollege"] option')
    )
      .map((option) => ({ value: option.value.trim(), label: option.textContent.trim() }))
      .filter((option) => option.value);
    const departments = Array.from(
      documentNode.querySelectorAll('select[name="qdept"] option')
    )
      .map((option) => ({
        value: option.value.trim(),
        label: option.textContent.trim(),
        college:
          option.parentElement?.tagName === "OPTGROUP"
            ? option.parentElement.label.trim()
            : "其它",
      }))
      .filter((option) => option.value);
    return { years, colleges, departments };
  }

  function estimatedAcademicYear() {
    const today = new Date();
    return String(today.getFullYear() - 1911 - (today.getMonth() < 7 ? 1 : 0));
  }

  function updateDepartmentOptions(selectedValue = "") {
    const college = collegeSelect.value;
    const departments = college
      ? state.departments.filter((department) => department.college === college)
      : state.departments;
    replaceOptions(departmentSelect, departments, "全部系所");
    if (departments.some((department) => department.value === selectedValue)) {
      departmentSelect.value = selectedValue;
    }
  }

  async function loadOptionsAndSavedFilters() {
    const [optionsResponse, saved] = await Promise.all([
      sendMessage({ type: "load-course-options" }),
      storageGet({ [FILTERS_KEY]: {} }),
    ]);
    const options = parseOfficialOptions(optionsResponse.html);
    replaceOptions(yearSelect, options.years);
    replaceOptions(collegeSelect, options.colleges, "全部學院");
    state.departments = options.departments;
    updateDepartmentOptions();

    const savedFilters = saved[FILTERS_KEY] || {};
    const year = savedFilters.academicYear || options.years[0]?.value || estimatedAcademicYear();
    yearSelect.value = year;
    setFormFilters(savedFilters);
  }

  function formFilters() {
    return {
      queryMode: queryModeSelect.value,
      academicYear: yearSelect.value,
      term: document.querySelector("#term").value,
      education: document.querySelector("#education").value,
      college: collegeSelect.value,
      department: departmentSelect.value,
      grade: document.querySelector("#grade").value,
      className: document.querySelector("#className").value,
      courseKeyword: document.querySelector("#courseKeyword").value,
      requirementKind: document.querySelector("#requirementKind").value,
      language: document.querySelector("#language").value,
      generalCategory: document.querySelector("#generalCategory").value,
      generalGroup: "",
      physicalEducation: document.querySelector("#physicalEducation").value,
      weekday: document.querySelector("#weekday").value,
      startPeriod: document.querySelector("#startPeriod").value,
      endPeriod: document.querySelector("#endPeriod").value,
      onlyRestricted: document.querySelector("#onlyRestricted").checked,
      onlyEighteenWeeks: document.querySelector("#onlyEighteenWeeks").checked,
    };
  }

  function setFormFilters(filters) {
    const migratedKeyword = [
      filters.courseKeyword,
      filters.courseCode,
      filters.courseName,
      filters.teacher,
      filters.memo,
    ]
      .filter(Boolean)
      .join(" ");
    const normalizedFilters = {
      ...filters,
      courseKeyword: migratedKeyword,
      queryMode: filters.queryMode || "all",
    };
    const valueFields = [
      "queryMode",
      "term",
      "education",
      "grade",
      "className",
      "courseKeyword",
      "requirementKind",
      "language",
      "generalCategory",
      "physicalEducation",
      "weekday",
      "startPeriod",
      "endPeriod",
    ];
    valueFields.forEach((id) => {
      if (normalizedFilters[id] === undefined) return;
      document.querySelector(`#${id}`).value = normalizedFilters[id];
    });
    updateQueryModeFields();
    collegeSelect.value = normalizedFilters.college || "";
    updateDepartmentOptions(normalizedFilters.department || "");
    document.querySelector("#onlyRestricted").checked = Boolean(normalizedFilters.onlyRestricted);
    document.querySelector("#onlyEighteenWeeks").checked = Boolean(
      normalizedFilters.onlyEighteenWeeks
    );
  }

  function updateQueryModeFields() {
    const mode = queryModeSelect.value;
    document.querySelectorAll(".mode-field").forEach((field) => {
      field.hidden = true;
    });
    const fieldByMode = {
      required: "#requirementKindField",
      language: "#languageField",
      general: "#generalCategoryField",
      physical: "#physicalEducationField",
    };
    if (fieldByMode[mode]) document.querySelector(fieldByMode[mode]).hidden = false;
    const showsUnitFilters = mode === "all" || mode === "required";
    document.querySelector("#unitFilterSection").hidden = !showsUnitFilters;
    document.querySelector("#unitFilterTitle").textContent =
      mode === "required" ? "應修系所與年級" : "開課單位";
  }

  function cleanLines(element) {
    const clone = element.cloneNode(true);
    clone.querySelectorAll("br").forEach((lineBreak) => {
      lineBreak.replaceWith("\n");
    });
    return clone.textContent
      .split("\n")
      .map((line) => line.replace(/\u00a0/g, " ").trim())
      .filter(Boolean);
  }

  function absoluteOfficialUrl(value) {
    if (!value) return "";
    return new URL(value, OFFICIAL_BASE).href;
  }

  function courseDetails(cell) {
    const links = cell.querySelectorAll("a");
    const contentWithoutRestriction = cell.cloneNode(true);
    contentWithoutRestriction.querySelectorAll("a")[1]?.remove();
    const name = links[0]?.textContent.trim() || cleanLines(contentWithoutRestriction)[0] || "未命名課程";
    const lines = cleanLines(contentWithoutRestriction).filter((line) => line !== name);
    const notesIndex = lines.findIndex((line) => line.startsWith("備註："));
    const englishName = notesIndex < 0 ? lines[0] || "" : lines.slice(0, notesIndex).join(" ");
    const notes = notesIndex < 0 ? "" : lines.slice(notesIndex).join(" ").replace(/^備註：/, "");
    return {
      name,
      englishName,
      notes,
      detailUrl: absoluteOfficialUrl(links[0]?.getAttribute("href")),
      restrictionUrl: absoluteOfficialUrl(links[1]?.getAttribute("href")),
      restrictionLabel: links[1]?.textContent.trim() || "查看課程限制",
    };
  }

  function splitCellNodesByLine(cell) {
    const content = cell.querySelector("p") || cell;
    return Array.from(content.childNodes).reduce(
      (lines, node) => {
        if (node.nodeName === "BR") lines.push([]);
        else lines[lines.length - 1].push(node);
        return lines;
      },
      [[]]
    );
  }

  function requirementDetails(requiredCell, typeCell) {
    const requiredItems = splitCellNodesByLine(requiredCell)
      .map((nodes) => {
        const linkNode = nodes.find(
          (node) => node.nodeType === Node.ELEMENT_NODE && node.nodeName === "A"
        );
        return {
          label: nodes
            .filter((node) => node.nodeType === Node.TEXT_NODE)
            .map((node) => node.textContent)
            .join("")
            .replace(/\u00a0/g, " ")
            .trim(),
          url: absoluteOfficialUrl(linkNode?.getAttribute("href")),
        };
      })
      .filter((item) => item.label || item.url);
    const requirementTypes = splitCellNodesByLine(typeCell)
      .map((nodes) => nodes.map((node) => node.textContent || "").join("").trim())
      .filter(Boolean);
    return NTPUCourseQueryCore.pairCourseRequirements(requiredItems, requirementTypes);
  }

  function textWithoutLinks(cell) {
    const clone = cell.cloneNode(true);
    clone.querySelectorAll("a").forEach((link) => link.remove());
    return cleanLines(clone).join(" ");
  }

  function parseCourseResults(html) {
    const documentNode = new DOMParser().parseFromString(html, "text/html");
    const table = documentNode.querySelector("table#example");
    if (!table) return { courses: [], officialCount: 0 };
    const rows = Array.from(table.querySelectorAll("tbody tr, tr"));
    const courses = rows
      .map((row) => Array.from(row.querySelectorAll("td")))
      .filter((cells) => cells.length >= 18)
      .map((cells) => {
        const requirements = requirementDetails(cells[5], cells[6]);
        const values = cells.map((cell) => cell.innerText.replace(/\u00a0/g, " ").trim());
        values[5] = textWithoutLinks(cells[5]);
        values[8] = [...new Set(cleanLines(cells[8]))].join("、");
        return NTPUCourseQueryCore.normalizeCourseCells(values, {
          ...courseDetails(cells[7]),
          requirements,
        });
      });
    const pageText = documentNode.body?.innerText || "";
    const countMatch = pageText.match(/共找到\s*([\d,]+)\s*筆課程/);
    const officialCount = countMatch ? Number(countMatch[1].replace(/,/g, "")) : courses.length;
    return { courses, officialCount };
  }

  function element(tag, className, textContent) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (textContent !== undefined) node.textContent = textContent;
    return node;
  }

  function addMeta(container, label, value) {
    if (!value) return;
    container.appendChild(element("span", "", `${label}：${value}`));
  }

  function badge(textContent, modifier = "") {
    return element("span", `query-badge ${modifier}`.trim(), textContent);
  }

  function linkedBadge(textContent, url, modifier = "") {
    const link = element("a", `query-badge query-badge-link ${modifier}`.trim(), textContent);
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";
    return link;
  }

  function summarized(value, maximumLength = 70) {
    const normalized = String(value || "").replace(/\s+/g, " ").trim();
    return normalized.length > maximumLength
      ? `${normalized.slice(0, maximumLength)}…`
      : normalized;
  }

  async function createCourseCard(course, schedules) {
    const card = element("article", "query-card");
    const main = element("div", "query-main");
    const title = element("div", "query-title");
    title.appendChild(element("span", "query-code", course.courseCode || "無流水號"));
    const heading = element("h3");
    if (course.detailUrl) {
      const link = element("a", "", course.name);
      link.href = course.detailUrl;
      link.target = "_blank";
      link.rel = "noopener";
      heading.appendChild(link);
    } else {
      heading.textContent = course.name;
    }
    title.appendChild(heading);
    main.appendChild(title);
    if (course.englishName) main.appendChild(element("p", "query-english", course.englishName));

    const meta = element("div", "query-meta");
    addMeta(meta, "開課單位", course.owner);
    addMeta(meta, "教師", course.teacher);
    addMeta(meta, "時間地點", course.timePlace || "未維護");
    main.appendChild(meta);

    const badges = element("div", "query-badges");
    badges.append(
      badge(`${course.credits || "—"} 學分`),
      badge(`${course.hours || "—"} 小時`),
      badge(course.language || "語言未標示"),
      badge(course.canAddWithApproval ? "開放加簽" : "不開放加簽")
    );
    if (course.requirements.length) {
      course.requirements.forEach((requirement) => {
        const typeSuffix = requirement.type ? `（${requirement.type}）` : "";
        const label = `${requirement.label}${typeSuffix}`;
        badges.appendChild(
          requirement.url
            ? linkedBadge(`有擋修：${label}`, requirement.url, "is-warning")
            : badge(label)
        );
      });
    } else if (course.requiredFor) {
      const requiredBadge = badge(`應修：${summarized(course.requiredFor)}`);
      requiredBadge.title = course.requiredFor;
      badges.appendChild(requiredBadge);
    }
    if (!course.requirements.length && course.requirementType) {
      const typeBadge = badge(`必選修：${summarized(course.requirementType)}`);
      typeBadge.title = course.requirementType;
      badges.appendChild(typeBadge);
    }
    if (course.restrictionUrl) {
      badges.appendChild(
        linkedBadge(course.restrictionLabel || "查看課程限制", course.restrictionUrl, "is-warning")
      );
    }
    const requirementUrls = new Set(course.requirements.map((item) => item.url).filter(Boolean));
    course.prerequisites
      .filter((prerequisite) => !requirementUrls.has(prerequisite.url))
      .forEach((prerequisite) => {
      badges.appendChild(
        linkedBadge(`擋修：${prerequisite.label}`, prerequisite.url, "is-warning")
      );
      });
    if (course.availableSeats !== null) {
      badges.appendChild(
        badge(
          course.availableSeats > 0 ? `尚有 ${course.availableSeats} 個名額` : "目前額滿",
          course.availableSeats > 0 ? "is-open" : "is-full"
        )
      );
    }
    main.appendChild(badges);
    if (course.notes) main.appendChild(element("p", "query-notes", course.notes));

    const side = element("div", "query-side");
    const seats = element("dl", "seat-stats");
    const seatRows = [
      ["限修人數", course.capacity],
      ["已選人數", course.selected],
      ["已核准人數", course.approved],
      ["剩餘名額", course.availableSeats],
    ];
    seatRows.forEach(([label, value]) => {
      if (value === null && label === "已核准人數") return;
      const row = element("div", "seat-stat-row");
      row.append(element("dt", "", label), element("dd", "", value === null ? "未提供" : String(value)));
      seats.appendChild(row);
    });
    side.appendChild(seats);

    const semesterId = `${course.academicYear}-${course.term}`;
    const exists = (schedules[semesterId] || []).some((storedCourse) =>
      NTPUPlannerCore.isSameCourse(storedCourse, course)
    );
    const addButton = element("button", "trial-add", exists ? "已加入試排課" : "加入試排課");
    addButton.type = "button";
    addButton.disabled = exists;
    addButton.addEventListener("click", async () => {
      addButton.disabled = true;
      try {
        await NTPUPlannerStorage.addCourse(course);
        addButton.textContent = "已加入試排課";
      } catch (error) {
        addButton.disabled = false;
        addButton.textContent = "加入失敗，請重試";
      }
    });
    side.appendChild(addButton);
    card.append(main, side);
    return card;
  }

  async function renderResults() {
    const localFilters = {
      ...state.clientFilters,
      searchText: searchTextInput.value,
      availability: availabilitySelect.value,
      sortBy: sortSelect.value,
    };
    const courses = NTPUCourseQueryCore.filterAndSortCourses(state.courses, localFilters);
    const schedules = await NTPUPlannerStorage.loadSchedules();
    courseResults.replaceChildren();
    const cards = await Promise.all(courses.map((course) => createCourseCard(course, schedules)));
    courseResults.append(...cards);
    resultSummary.textContent = `官方回傳 ${state.officialCount} 門，目前顯示 ${courses.length} 門`;
    statusBox.hidden = courses.length > 0;
    if (courses.length === 0) {
      statusBox.className = "status-box";
      statusBox.textContent = state.courses.length
        ? "官方有回傳課程，但沒有符合目前的結果內篩選。"
        : "找不到符合條件的課程。";
    }
  }

  async function runQuery(event) {
    event.preventDefault();
    submitButton.disabled = true;
    submitButton.textContent = "查詢中…";
    statusBox.hidden = false;
    statusBox.className = "status-box is-loading";
    statusBox.textContent = "正在向北大官方課程系統查詢，資料較多時可能需要數秒。";
    courseResults.replaceChildren();
    resultTools.hidden = true;

    const filters = formFilters();
    const query = NTPUCourseQueryCore.buildCourseQuery(filters);
    try {
      await storageSet({ [FILTERS_KEY]: filters });
      const response = await queryThroughOfficialPage(query);
      const parsed = parseCourseResults(response.html);
      state.courses = parsed.courses;
      state.officialCount = parsed.officialCount;
      state.clientFilters = query.clientFilters;
      resultTools.hidden = false;
      statusBox.hidden = true;
      await renderResults();
    } catch (error) {
      state.courses = [];
      resultSummary.textContent = "查詢失敗";
      statusBox.hidden = false;
      statusBox.className = "status-box is-error";
      statusBox.textContent = `無法完成查詢：${error.message}`;
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "查詢課程";
    }
  }

  function resetQuery() {
    form.reset();
    yearSelect.selectedIndex = 0;
    collegeSelect.value = "";
    updateDepartmentOptions();
    document.querySelector("#startPeriod").value = "A";
    document.querySelector("#endPeriod").value = "M";
    updateQueryModeFields();
  }

  collegeSelect.addEventListener("change", () => updateDepartmentOptions());
  queryModeSelect.addEventListener("change", updateQueryModeFields);
  form.addEventListener("submit", runQuery);
  resetButton.addEventListener("click", resetQuery);
  [searchTextInput, availabilitySelect, sortSelect].forEach((control) => {
    control.addEventListener("input", () => renderResults());
    control.addEventListener("change", () => renderResults());
  });
  document.querySelector("#openPlanner").addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("planner.html") });
  });
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !Object.hasOwn(changes, "ntpuTrialSchedules")) return;
    if (state.courses.length) renderResults();
  });

  populatePeriods();
  updateQueryModeFields();
  loadOptionsAndSavedFilters().catch((error) => {
    replaceOptions(yearSelect, [{ value: estimatedAcademicYear(), label: estimatedAcademicYear() }]);
    statusBox.className = "status-box is-error";
    statusBox.textContent = `暫時無法載入官方選項：${error.message}`;
  });
})();

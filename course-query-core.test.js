const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildCourseQuery,
  filterAndSortCourses,
  normalizeCourseCells,
  pairCourseRequirements,
} = require("./course-query-core.js");

test("輸入課程流水號時使用關鍵字查詢端點", () => {
  const query = buildCourseQuery({
    queryMode: "all",
    academicYear: "114",
    term: "2",
    courseKeyword: "U2056",
  });

  assert.equal(query.type, "keyword");
  assert.equal(query.body.courseno, "U2056");
  assert.equal(query.body.qYear, "114");
  assert.equal(query.body.qTerm, "2");
});

test("必修查詢會使用官方必選修端點與對應參數", () => {
  const query = buildCourseQuery({
    queryMode: "required",
    academicYear: "114",
    term: "2",
    education: "U",
    department: "TU01",
    weekday: "3",
    startPeriod: "C",
    endPeriod: "F",
    onlyRestricted: true,
    onlyEighteenWeeks: true,
    courseKeyword: "資料結構",
    requirementKind: "必修",
  });

  assert.equal(query.type, "required");
  assert.equal(query.body.qDept, "TU01");
  assert.equal(query.body.qkind, "必修");
  assert.equal(query.body.week, "3");
  assert.equal(query.body.seq1, "C");
  assert.equal(query.body.seq2, "F");
  assert.equal(query.body.lm_check, "1");
  assert.equal(query.body.w18_check, "1");
  assert.equal(Object.hasOwn(query.body, "qEdu"), false);
  assert.equal(Object.hasOwn(query.body, "cour"), false);
  assert.equal(Object.hasOwn(query.body, "teach"), false);
  assert.equal(query.clientFilters.courseKeyword, "資料結構");
});

test("只選學院時會把學院送進官方查詢而不是查詢全校", () => {
  const allCoursesQuery = buildCourseQuery({
    queryMode: "all",
    academicYear: "114",
    term: "2",
    education: "U",
    college: "電機資訊學院",
    department: "",
  });
  const requiredQuery = buildCourseQuery({
    queryMode: "required",
    academicYear: "114",
    term: "2",
    college: "電機資訊學院",
    department: "",
  });

  assert.equal(allCoursesQuery.body.qCollege, "電機資訊學院");
  assert.equal(requiredQuery.body.qCollege, "電機資訊學院");
});

test("應修系級會逐項配對必選修別與該項擋修連結", () => {
  const requirements = pairCourseRequirements(
    [
      { label: "資訊安全與應用學士學分學程", url: "" },
      { label: "資工系1", url: "https://example.test/block" },
      { label: "資訊安全與應用學士微學程", url: "" },
    ],
    ["選", "必", "選"]
  );

  assert.deepEqual(requirements, [
    { label: "資訊安全與應用學士學分學程", type: "選", url: "" },
    { label: "資工系1", type: "必", url: "https://example.test/block" },
    { label: "資訊安全與應用學士微學程", type: "選", url: "" },
  ]);
});

test("官方表格欄位會轉成一致的課程資料", () => {
  const cells = Array.from({ length: 20 }, () => "");
  cells[0] = "1.";
  cells[1] = "114";
  cells[2] = "2";
  cells[3] = "U2056";
  cells[4] = "資訊工程學系";
  cells[8] = "王老師";
  cells[10] = "3";
  cells[11] = "3";
  cells[13] = "每週三3~5 電1F01";
  cells[14] = "是";
  cells[15] = "5";
  cells[16] = "50";
  cells[18] = "48";

  const course = normalizeCourseCells(cells, {
    name: "資料結構",
    detailUrl: "https://example.test/U2056",
    restrictionUrl: "https://example.test/restriction/U2056",
    prerequisites: [{ label: "有擋修", url: "https://example.test/prerequisite/U2056" }],
  });

  assert.equal(course.courseCode, "U2056");
  assert.equal(course.name, "資料結構");
  assert.equal(course.availableSeats, 2);
  assert.equal(course.canAddWithApproval, true);
  assert.equal(course.restrictionUrl, "https://example.test/restriction/U2056");
  assert.equal(course.prerequisites.length, 1);
});

test("結果可依關鍵字過濾並將尚有名額的課程排在前面", () => {
  const courses = [
    { name: "程式設計", courseCode: "U1001", teacher: "王老師", owner: "資工", availableSeats: 0 },
    { name: "資料結構", courseCode: "U2056", teacher: "李老師", owner: "資工", availableSeats: 3 },
    { name: "經濟學", courseCode: "U3001", teacher: "陳老師", owner: "經濟", availableSeats: 8 },
  ];

  const result = filterAndSortCourses(courses, {
    searchText: "資工",
    availability: "available",
    sortBy: "availability",
  });

  assert.deepEqual(result.map((course) => course.courseCode), ["U2056"]);
});

test("中文課名與教師在解析結果後進行本機篩選", () => {
  const courses = [
    { name: "資料結構", teacher: "王老師", notes: "", courseCode: "U2056", owner: "資工" },
    { name: "資料庫", teacher: "李老師", notes: "", courseCode: "U3056", owner: "資工" },
  ];

  const result = filterAndSortCourses(courses, {
    courseKeyword: "資料 王",
  });

  assert.deepEqual(result.map((course) => course.courseCode), ["U2056"]);
});

test("結果內搜尋可容忍一個中文字輸入錯誤", () => {
  const courses = [
    { name: "資料結構", englishName: "Data Structures", teacher: "王老師", courseCode: "U2056", owner: "資工", notes: "" },
    { name: "經濟學", englishName: "Economics", teacher: "李老師", courseCode: "U3001", owner: "經濟", notes: "" },
  ];

  const result = filterAndSortCourses(courses, { searchText: "資枓結構" });

  assert.deepEqual(result.map((course) => course.courseCode), ["U2056"]);
});

test("外語與暑修模式會映射到各自的官方端點", () => {
  const languageQuery = buildCourseQuery({
    queryMode: "language",
    academicYear: "114",
    term: "2",
    language: "2",
  });
  const summerQuery = buildCourseQuery({
    queryMode: "summer",
    academicYear: "114",
    term: "2",
  });

  assert.equal(languageQuery.type, "language");
  assert.equal(languageQuery.body.lang, "2");
  assert.equal(summerQuery.type, "summer");
  assert.equal(Object.hasOwn(summerQuery.body, "w18_check"), false);
  assert.equal(Object.hasOwn(summerQuery.body, "cour"), false);
});

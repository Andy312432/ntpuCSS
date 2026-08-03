const test = require("node:test");
const assert = require("node:assert/strict");

const {
  addCourse,
  createCourseId,
  createSemesterId,
  isSameCourse,
  parseMeetingSlots,
  removeCourse,
} = require("./planner-core.js");

const course = {
  academicYear: "114",
  term: "1",
  serialNumber: "1234",
  courseCode: "U1234",
  name: "程式設計",
  teacher: "王老師",
  credits: "3",
  timePlace: "星期一 3-4 資電101",
};

test("用學年度與學期建立一致的學期識別碼", () => {
  assert.equal(createSemesterId(" 114 ", "1"), "114-1");
  assert.equal(createSemesterId("099", "2"), "099-2");
  assert.throws(() => createSemesterId("114", "3"), /學期/);
});

test("同一學期重複新增同一門課時不會產生重複資料", () => {
  const once = addCourse({}, course);
  const twice = addCourse(once, course);

  assert.equal(twice["114-1"].length, 1);
  assert.equal(twice["114-1"][0].id, createCourseId(course));
  assert.equal(createCourseId(course), "114-1:U1234");
});

test("頁面序號相同但課程代碼不同時仍視為不同課程", () => {
  const other = {
    ...course,
    courseCode: "U5678",
    name: "資料結構",
  };

  const schedule = addCourse(addCourse({}, course), other);

  assert.equal(schedule["114-1"].length, 2);
  assert.equal(isSameCourse(course, other), false);
});

test("舊資料的識別碼不同但課程代碼相同時會更新而不重複新增", () => {
  const legacyCourse = { ...course, id: "114-1:1234", teacher: "舊教師" };

  const schedule = addCourse({ "114-1": [legacyCourse] }, course);

  assert.equal(schedule["114-1"].length, 1);
  assert.equal(schedule["114-1"][0].id, "114-1:U1234");
  assert.equal(schedule["114-1"][0].teacher, "王老師");
});

test("可從指定學期刪除單一課程且保留其他課程", () => {
  const other = {
    ...course,
    serialNumber: "5678",
    courseCode: "U5678",
    name: "資料結構",
  };
  const schedule = addCourse(addCourse({}, course), other);

  const result = removeCourse(schedule, "114-1", createCourseId(course));

  assert.deepEqual(result["114-1"].map((item) => item.name), ["資料結構"]);
});

test("解析北大課程常見的中文星期與連續節次", () => {
  assert.deepEqual(parseMeetingSlots("星期一 3-4 資電101"), [
    { day: 1, period: "3", location: "資電101" },
    { day: 1, period: "4", location: "資電101" },
  ]);
});

test("同一門課有多個上課時段時全部保留", () => {
  assert.deepEqual(parseMeetingSlots("一1-2 商2F01\n三5 商2F01"), [
    { day: 1, period: "1", location: "商2F01" },
    { day: 1, period: "2", location: "商2F01" },
    { day: 3, period: "5", location: "商2F01" },
  ]);
});

test("時間與教室分行顯示時仍會把教室配到前一個時段", () => {
  assert.deepEqual(parseMeetingSlots("每週一5~6\n商2F01\n每週三7\n商2F01"), [
    { day: 1, period: "5", location: "商2F01" },
    { day: 1, period: "6", location: "商2F01" },
    { day: 3, period: "7", location: "商2F01" },
  ]);
});

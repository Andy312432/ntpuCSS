const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildOfficialQueryRequest,
  officialFormUrl,
} = require("./course-query-transport.js");

test("每一種查詢都先載入其官方表單頁，而不是從外掛來源直接送出", () => {
  const expectedForms = {
    conditions: "CHI_query_common",
    keyword: "CHI_query_keyword",
    required: "CHI_query_ReOp",
    language: "CHI_query_Lang",
    general: "CHI_query_other",
    physical: "CHI_query_PE",
    summer: "CHI_query_SUMMER",
  };

  Object.entries(expectedForms).forEach(([type, formName]) => {
    assert.match(officialFormUrl(type), new RegExp(`${formName}$`, "i"));
  });
});

test("必修查詢使用官方要求的 GET 並保留 Big5 表單值", () => {
  const request = buildOfficialQueryRequest({
    type: "required",
    body: { qYear: "114", qTerm: "2", qkind: "必修" },
  });

  assert.equal(request.method, "GET");
  assert.match(
    request.url,
    /queryByReOp\?qYear=114&qTerm=2&qkind=%A5%B2%AD%D7$/
  );
  assert.equal(request.body, undefined);
});

test("外語等其餘官方表單仍依原規格使用 POST", () => {
  const request = buildOfficialQueryRequest({
    type: "language",
    body: { qYear: "114", qTerm: "2", lang: "1" },
  });

  assert.equal(request.method, "POST");
  assert.match(request.url, /queryByLang$/);
  assert.equal(request.body, "qYear=114&qTerm=2&lang=1");
});

test("中文學院名稱會使用校方 Big5 表單編碼", () => {
  const request = buildOfficialQueryRequest({
    type: "conditions",
    body: { qYear: "114", qCollege: "電機資訊學院", qdept: "" },
  });

  assert.equal(
    request.body,
    "qYear=114&qCollege=%B9%71%BE%F7%B8%EA%B0%54%BE%C7%B0%7C&qdept="
  );
});

test("未知查詢類型會被拒絕", () => {
  assert.throws(() => officialFormUrl("missing"), /不支援/);
});

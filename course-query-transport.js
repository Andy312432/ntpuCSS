(function exposeCourseQueryTransport(globalScope) {
  "use strict";

  const BASE_URL = "https://sea.cc.ntpu.edu.tw/pls/dev_stud/";
  const ROUTES = Object.freeze({
    conditions: ["course_query_all.CHI_query_common", "course_query_all.queryByAllConditions"],
    keyword: ["course_query_all.CHI_query_keyword", "course_query_all.queryByKeyword"],
    required: ["course_query_all.CHI_query_ReOp", "course_query_all.queryByReOp", "GET"],
    language: ["course_query_all.CHI_query_Lang", "course_query_all.queryByLang"],
    general: ["course_query_all.CHI_query_other", "course_query_all.queryByOther"],
    physical: ["course_query_all.CHI_query_PE", "course_query_all.queryByPE"],
    summer: ["course_query_all.CHI_query_SUMMER", "course_query_all.queryBySUMMER"],
  });
  const BIG5_VALUES = Object.freeze({
    必選修: "%A5%B2%BF%EF%AD%D7",
    必修: "%A5%B2%AD%D7",
    選修: "%BF%EF%AD%D7",
    法律學院: "%AA%6B%AB%DF%BE%C7%B0%7C",
    商學院: "%B0%D3%BE%C7%B0%7C",
    公共事務學院: "%A4%BD%A6%40%A8%C6%B0%C8%BE%C7%B0%7C",
    社會科學學院: "%AA%C0%B7%7C%AC%EC%BE%C7%BE%C7%B0%7C",
    人文學院: "%A4%48%A4%E5%BE%C7%B0%7C",
    電機資訊學院: "%B9%71%BE%F7%B8%EA%B0%54%BE%C7%B0%7C",
    永續創新國際學院: "%A5%C3%C4%F2%B3%D0%B7%73%B0%EA%BB%DA%BE%C7%B0%7C",
    通識教育中心: "%B3%71%C3%D1%B1%D0%A8%7C%A4%A4%A4%DF",
  });

  function routeFor(type) {
    if (!Object.hasOwn(ROUTES, type)) throw new Error("不支援的課程查詢方式");
    return ROUTES[type];
  }

  function officialFormUrl(type) {
    return BASE_URL + routeFor(type)[0];
  }

  function encodeFormBody(values = {}) {
    return Object.entries(values)
      .map(([key, value]) => {
        const normalized = String(value ?? "");
        const encoded = Object.hasOwn(BIG5_VALUES, normalized)
          ? BIG5_VALUES[normalized]
          : encodeURIComponent(normalized);
        return `${encodeURIComponent(key)}=${encoded}`;
      })
      .join("&");
  }

  function buildOfficialQueryRequest(query) {
    if (!query) throw new Error("缺少課程查詢條件");
    const route = routeFor(query.type);
    const method = route[2] || "POST";
    const encodedBody = encodeFormBody(query.body);
    return {
      method,
      url: BASE_URL + route[1] + (method === "GET" ? `?${encodedBody}` : ""),
      body: method === "GET" ? undefined : encodedBody,
    };
  }

  const transport = Object.freeze({ buildOfficialQueryRequest, officialFormUrl });
  globalScope.NTPUCourseQueryTransport = transport;
  if (typeof module !== "undefined" && module.exports) module.exports = transport;
})(typeof globalThis === "undefined" ? window : globalThis);

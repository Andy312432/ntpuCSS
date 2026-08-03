"use strict";

const COURSE_OPTIONS_URL =
  "https://sea.cc.ntpu.edu.tw/pls/dev_stud/course_query_all.CHI_query_common";

async function decodeBig5Response(response) {
  if (!response.ok) throw new Error(`北大查詢系統回傳 ${response.status}`);
  const bytes = await response.arrayBuffer();
  return new TextDecoder("big5").decode(bytes);
}

async function loadCourseOptions() {
  const response = await fetch(COURSE_OPTIONS_URL, { credentials: "include" });
  return decodeBig5Response(response);
}

function respondWith(promise, sendResponse) {
  promise
    .then((html) => sendResponse({ ok: true, html }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message) return false;
  if (message.type === "open-trial-planner") {
    chrome.tabs.create({ url: chrome.runtime.getURL("planner.html") });
    return false;
  }
  if (message.type === "open-course-search") {
    chrome.tabs.create({ url: chrome.runtime.getURL("search.html") });
    return false;
  }
  if (message.type === "load-course-options") {
    respondWith(loadCourseOptions(), sendResponse);
    return true;
  }
  return false;
});

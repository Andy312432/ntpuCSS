// content.js

/**
 * 等待某個 selector 的元素出現
 * @param {string} selector CSS 選擇器
 * @param {Node} [root=document.body] 要監控的根節點
 * @returns {Promise<Element>} 當元素出現時，resolve 該元素
 */
function waitForElement(selector, root = document.body) {
  return new Promise((resolve) => {
    // 如果已經存在，立刻回傳
    const existing = root.querySelector(selector);
    if (existing) {
      resolve(existing);
      return;
    }

    const observer = new MutationObserver((mutations, obs) => {
      // 每次 DOM 有變化就查詢
      const el = root.querySelector(selector);
      if (el) {
        obs.disconnect(); // 停止監控
        resolve(el);
      }
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
    });
  });
}

function transformTableToCards(tableEl) {
  const tbody = tableEl.querySelector("tbody");
  if (!tbody) return;

  const rows = Array.from(tbody.querySelectorAll("tr"));
  const container = document.createElement("div");
  container.className = "modern-cards";

  rows.forEach((row) => {
    const cols = row.querySelectorAll("td");

    const courseNo = cols[0]?.innerText.replace(".", "").trim() || "";
    const courseSemester =
      cols[1]?.innerText.trim() + "-" + cols[2]?.innerText.trim() || "";
    const courseCode = cols[3]?.innerText.trim() || "";
    const courseOwner = cols[4]?.innerText.trim() || "";
    const courseRequiredGrade = Array.from(
      cols[5]?.querySelector("p")?.childNodes || []
    )
      .reduce(
        (acc, n) =>
          n.nodeName === "BR"
            ? (acc.push([]), acc)
            : (acc[acc.length - 1].push(n), acc),
        [[]]
      )
      .map((nodes) => ({
        text: nodes
          .map((n) => (n.nodeType === Node.TEXT_NODE ? n.textContent : ""))
          .join("")
          .replace(/\u00a0/g, " ")
          .trim(),
        link:
          nodes
            .find((n) => n.nodeType === Node.ELEMENT_NODE && n.nodeName === "A")
            ?.getAttribute("href") || null,
      }))
      .filter((x) => x.text || x.link);

    const courseRequiredType = Array.from(cols[6]?.childNodes || [])
      .reduce(
        (acc, n) =>
          n.nodeName === "BR"
            ? (acc.push([]), acc)
            : (acc[acc.length - 1].push(n), acc),
        [[]]
      )
      .map((nodes) =>
        nodes
          .map((n) => n.textContent || "")
          .join("")
          .replace(/\u00a0/g, " ")
          .trim()
      )
      .filter(Boolean);

    const gradeChips = [];
    for (let i = 0; i < courseRequiredGrade.length; i++) {
      const item = courseRequiredGrade[i];
      const type = courseRequiredType[i] || "";
      const typeSuffix = type === "" ? "" : `(${type})`;
      const label = `${item.text || ""}${typeSuffix}`;
      if (item.link) {
        gradeChips.push(
          `<a href="${item.link}"><span class="info-card red"><b>有擋修：</b>${label}</span></a>`
        );
      } else {
        gradeChips.push(`<span class="info-card typical">${label}</span>`);
      }
    }
    const maxGradeChips = 5;
    const gradeChipsShort = gradeChips.slice(0, maxGradeChips);
    const gradeChipsOverflow = gradeChips.slice(maxGradeChips);
    const hasGradeContent = gradeChips.length > 0;
    const gradeShortHTML = hasGradeContent
      ? `<div class="info-card-container grade-chips--short">` +
        gradeChipsShort.join("") +
        (gradeChipsOverflow.length
          ? `<span class="info-card typical grade-more">+${gradeChipsOverflow.length}<span class="grade-popover">${gradeChipsOverflow.join("")}</span></span>`
          : "") +
        `</div>`
      : `<div class="info-card-container grade-chips--short"><span class="info-card typical">無</span></div>`;
    const gradeFullHTML = hasGradeContent
      ? `<div class="info-card-container grade-chips--full">` +
        gradeChips.join("") +
        `</div>`
      : `<div class="info-card-container grade-chips--full"><span class="info-card typical">無</span></div>`;
    const gradeHTML = gradeShortHTML + gradeFullHTML;
    const linkEls = cols[7].querySelectorAll("a");
    const courseName = linkEls[0]?.innerText.trim() || "";
    const courseRestrictLink = linkEls[1]?.href || "";
    const courseRestrictLabel = linkEls[1]?.innerText?.trim() || "有限制";
    let restrictHTML = "";
    if (courseRestrictLink) {
      restrictHTML = `<a href="${courseRestrictLink}"><span class="info-card red"><b>${courseRestrictLabel}</b></span></a>`;
    }
    const courseEngName =
      cols[7].innerText.replace(courseName, "").split("\n\n")[0].trim() || "";
    const courseInfo =
      cols[7].textContent
        .replace(courseName, "")
        .replace(courseEngName, "")
        .replace("備註：", "")
        .trim()
        .replace(/\n/g, "<br>") || "";
    const teacher = cols[8]?.querySelectorAll("a");
    let teacherHTML = "";
    teacher.forEach((t, index) => {
      teacherHTML +=
        `<a href=${t.href}><span class="info-card teacher">` +
        t.innerText.trim() +
        `</span></a>`;
    });
    if (teacher.length && teacher[0].innerText.trim() === "******") {
      teacherHTML = `<a href=${teacher[0].href}><span class="info-card teacher">(教師未知)</span></a>`;
    }
    const courseType = cols[9]?.innerText.trim() + "學年" || "";
    const courseCredit = cols[10]?.innerText.trim() || "";
    const courseLength = cols[11]?.innerText.trim() || "";
    const courseLang = cols[12]?.innerText.trim() || "";
    const langClass = courseLang === "中文" ? "typical" : "warn";
    const langHTML = `<span class="info-card ${langClass}">${courseLang}</span>`;
    let timePlace = cols[13]?.innerText.trim() || "";
    if (timePlace == "每週未維護0") timePlace = "（未知）";
    const timePlaceLinks = Array.from(
      cols[13]?.querySelectorAll("a") || []
    );
    const timePlaceHTML = timePlaceLinks.length
      ? timePlaceLinks
          .map(
            (a) =>
              `<a class="course-link" href="${a.href}">${a.innerText.trim()}</a>`
          )
          .join("<br>")
      : timePlace.replace(/\n/g, "<br>");
    const abovelimit = cols[14]?.innerText.trim() == "是";
    const pluslimit =
      cols[15]?.innerText.trim() == "-" ? "0" : cols[15]?.innerText.trim();
    const limitTotal    = cols[16]?.innerText.trim() || ""; // 限修總計人數
    const selectedTotal = cols[17]?.innerText.trim() || ""; // 已選總計人數
    const approvedTotal = cols[18]?.innerText.trim() || ""; // 已核准人數
    const pendingTotal  = cols[19]?.innerText.trim() || ""; // 待分發人數
    const signHTML = abovelimit
      ? `<span class="info-card green"><b>加簽</b>：限${pluslimit}人</span>`
      : `<span class="info-card typical">不可加簽</span>`;

    const teacherHTMLSafe = teacherHTML || "";
    const gradeHTMLSafe = gradeHTML || "";
    const restrictHTMLSafe = restrictHTML || "";

    const statCard = (label, value, type = "") => {
      if (value === "") return "";
      return `
        <div class="info-card ${type}">
          ${label}：${value}
        </div>
      `;
    };
    if (parseInt(approvedTotal) >= parseInt(limitTotal)) cardColor = "red" 
    else cardColor="typical"
    const countsHTML = `<div class="info-card-container">
        ${statCard("限修", limitTotal, cardColor)}
        ${statCard("已核准", approvedTotal, cardColor)}
        </div><div class="info-card-container">
        ${statCard("已選", selectedTotal, "typical")}
        ${statCard("待分發", pendingTotal, "typical")}
        </div>
    `;


    // 供排序用的欄位（都存成容易比較的值）
    const year = Number(cols[1]?.innerText.trim()) || 0;
    const term = Number(cols[2]?.innerText.trim()) || 0;

    const card = document.createElement("div");
    card.dataset.credit = String(Number(courseCredit) || 0);
    card.dataset.length = String(Number(courseLength) || 0);
    card.dataset.type = courseType;               // 文字排序
    card.dataset.timeRoom = timePlace;            // 若要更像人腦，建議再做 parse（下面有）

    card.className = "course-card";
    card.innerHTML = `
      <div class="course-badge-container">
        <div class="course-left">
          <div class="course-title">
            <div class="course-title-row">
              ${courseNo ? `<span class="course-no">#${courseNo}</span>` : ""}
              <span class="title-zh"><a href="${linkEls[0].href}">${courseName}</a></span>
            </div>
            ${courseEngName ? `<span class="title-en">${courseEngName}</span>` : ""}
          </div>
          <div class="course-meta">
            <div class="meta-line">
              <span class="meta-label">開課單位：</span>
              <span class="meta-value">${courseOwner}</span>
            </div>
            <div class="meta-line">
              <span class="meta-label">時間與地點：</span>
              <span class="meta-value">${timePlaceHTML}</span>
            </div>
          ${courseInfo ? `<div class="course-card__notes">${courseInfo}</div>` : ""}
          </div>
        </div>
        <div class="course-middle">
          <div class="info-card-container">
            <span class="info-card typical">${courseCode}</span>
            <span class="info-card typical">${courseSemester}</span>
            <span class="info-card typical">${courseCredit}學分/${courseLength}小時</span>
            <span class="info-card typical">${courseType}</span>
            ${langHTML}
          </div>
          <div class="info-card-container">
            ${teacherHTMLSafe}
            ${signHTML}
            ${restrictHTMLSafe}
          </div>
          <div class="course-mini-block">
            <div class="course-mini-label">應修系級 / 必選修別</div>
            ${gradeHTMLSafe}
          </div>
        </div>
        <div class="course-right">
            ${countsHTML}
        </div>
      </div>
    `;
    container.appendChild(card);
  });

  tableEl.style.display = "none";
  tableEl.parentNode.insertBefore(container, tableEl);
const sorter = sortableTable();
tableEl.parentNode.insertBefore(sorter, container);
attachCardSorter(sorter, container);

}

function sortableTable() {
  const modal = document.createElement("div");
  modal.className = "info-card-container";
  modal.innerHTML = `
    <p>排序依據：</p>
    <span class="sorting_asc info-card typical" data-key="time_room">上課時間、地點</span>
    <span class="sorting info-card typical" data-key="credit">學分</span>
    <span class="sorting info-card typical" data-key="length">時數</span>
    <span class="sorting info-card typical" data-key="type">類型</span>
  `;
  return modal;
}
function attachCardSorter(sortEl, container) {
  let currentKey = null;
  let currentDir = "asc"; // asc | desc

  // key 對應到 card.dataset 的欄位
  const keyToDataset = {
    time_room: "timeRoom",
    credit: "credit",
    length: "length",
    type: "type",
  };

  sortEl.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-key]");
    if (!btn) return;

    const key = btn.dataset.key;
    const dsKey = keyToDataset[key];
    if (!dsKey) return;

    // 同欄位就切換升降，換欄位就回 asc
    if (currentKey === key) currentDir = currentDir === "asc" ? "desc" : "asc";
    else { currentKey = key; currentDir = "asc"; }

    // 更新按鈕 class（sorting / sorting_asc / sorting_desc）
    sortEl.querySelectorAll("[data-key]").forEach((el) => {
      el.classList.remove("sorting_asc", "sorting_desc");
      el.classList.add("sorting");
    });
    btn.classList.remove("sorting");
    btn.classList.add(currentDir === "asc" ? "sorting_asc" : "sorting_desc");

    // 取 cards
    const cards = Array.from(container.querySelectorAll(".course-card"));

    // 排序（穩定排序：同值時用原本 index）
    const decorated = cards.map((card, idx) => ({
      card,
      idx,
      v: getSortValue(card.dataset[dsKey], dsKey),
    }));

    decorated.sort((a, b) => {
      let cmp = compare(a.v, b.v);
      if (currentDir === "desc") cmp = -cmp;
      return cmp || (a.idx - b.idx);
    });

    // 重新插入 = 重排
    decorated.forEach(({ card }) => container.appendChild(card));
  });
}

function getSortValue(raw, dsKey) {
  if (dsKey === "credit" || dsKey === "length") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : -Infinity;
  }
  if (dsKey === "timeRoom") {
    // 如果你要「上課時間、教室」更合理排序：用 parse
    return parseTimeRoom(raw);
  }
  return String(raw ?? "");
}

function compare(a, b) {
  // number
  if (typeof a === "number" && typeof b === "number") return a - b;

  // object (timeRoom tuple)
  if (a && b && typeof a === "object" && typeof b === "object") {
    const keys = ["day", "start", "room"];
    for (const k of keys) {
      const c = compare(a[k], b[k]);
      if (c) return c;
    }
    return 0;
  }

  // string
  return String(a).localeCompare(String(b), "zh-Hant");
}

// 依你的學校格式可再調整；這版至少不會炸
function parseTimeRoom(s) {
  const out = { day: 99, start: 999, room: "~~~~" };
  const text = String(s || "").trim();
  if (!text) return out;

  const dayMap = { "一":1,"二":2,"三":3,"四":4,"五":5,"六":6,"日":7,"天":7 };
  const dm = text.match(/[一二三四五六日天]/);
  if (dm) out.day = dayMap[dm[0]] ?? 99;

  const rm = text.match(/(\d+)\s*[-～~]\s*(\d+)/) || text.match(/(\d+)/);
  if (rm) out.start = Number(rm[1]);

  // 教室：抓最後一段英數（粗略但常用）
  const room = text.match(/([A-Za-z]\w*|\d+\w*|\w+\d+)\s*$/);
  if (room) out.room = room[1];

  return out;
}


function openModalWithUrl(url) {
  const modal = document.createElement("div");
  modal.style = `
    position: fixed;
    top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.5);
    display: flex; align-items: center; justify-content: center;
    border-radius: 4px;
    z-index: 10000;
  `;
  modal.innerHTML = `
    <div style="background: #fff; width: 80%; height: 80%; overflow: auto; position: relative;">
      <button id="modalClose" style="position: absolute; top: 10px; right: 10px;">X</button>
      <iframe src="${url}" style="width:100%; height:100%; border: none;"></iframe>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector("#modalClose").addEventListener("click", () => {
    document.body.removeChild(modal);
  });
}

document.addEventListener("click", function (e) {
  const a = e.target.closest("a");
  if (!a) return;

  const iframeDoc = document.querySelector("frame")?.contentDocument;
  if (a.ownerDocument !== iframeDoc) return;
  e.preventDefault();
  openModalWithUrl(a.href);
});

waitForElement("div#memo").then((contentEl) => {
  contentEl.querySelectorAll("p")[1].style.display = "none";
});

//Course Table
waitForElement("table#example").then((tableEl) => {
  transformTableToCards(tableEl);
});

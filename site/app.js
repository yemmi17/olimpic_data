const data = window.OLYMPICS_DATA;
const colors = [
  "#c99a2e",
  "#c43b46",
  "#2f8a7b",
  "#347ba8",
  "#7a58a7",
  "#b06b3a",
  "#506f86",
  "#d56f58",
  "#5d9c59",
  "#8c6fb8",
  "#d08a2f",
  "#4c8f9f",
];

const $ = (selector) => document.querySelector(selector);
const fmt = new Intl.NumberFormat("ru-RU");
let rendered = false;

function value(question) {
  return data.summary.find((item) => item.Question === question)?.Answer ?? "";
}

function svgEl(name, attrs = {}) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attrs).forEach(([key, val]) => el.setAttribute(key, val));
  return el;
}

function makeSvg(container, viewBox = "0 0 900 420") {
  const target = typeof container === "string" ? $(container) : container;
  target.innerHTML = "";
  const svg = svgEl("svg", { viewBox, role: "img" });
  target.appendChild(svg);
  return svg;
}

function text(svg, x, y, content, cls = "label", anchor = "start") {
  const t = svgEl("text", { x, y, class: cls, "text-anchor": anchor });
  t.textContent = content;
  svg.appendChild(t);
  return t;
}

function bars(selector, rows, labelKey, valueKeys, opts = {}) {
  const svg = makeSvg(selector);
  const width = 900;
  const height = 420;
  const margin = { top: 20, right: opts.right ?? 64, bottom: 46, left: opts.left ?? 180 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const maxVal = Math.max(...rows.map((row) => valueKeys.reduce((sum, key) => sum + Number(row[key] || 0), 0)));
  const step = plotH / rows.length;

  [0, 0.25, 0.5, 0.75, 1].forEach((p) => {
    const x = margin.left + plotW * p;
    svg.appendChild(svgEl("line", { x1: x, y1: margin.top, x2: x, y2: height - margin.bottom, class: "grid-line" }));
    text(svg, x, height - 14, fmt.format(Math.round(maxVal * p)), "tick", "middle");
  });

  rows.forEach((row, idx) => {
    const y = margin.top + idx * step + 6;
    const h = Math.max(12, step - 10);
    text(svg, margin.left - 14, y + h * 0.68, row[labelKey], "label", "end");
    let x = margin.left;
    let total = 0;
    valueKeys.forEach((key, keyIdx) => {
      const val = Number(row[key] || 0);
      total += val;
      const w = maxVal ? (val / maxVal) * plotW : 0;
      svg.appendChild(svgEl("rect", { x, y, width: w, height: h, rx: 5, fill: colors[keyIdx % colors.length] }));
      x += w;
    });
    text(svg, Math.min(x + 10, width - 8), y + h * 0.68, fmt.format(total), "value-label", "start");
  });
}

function columns(selector, rows, labelKey, valueKey) {
  const svg = makeSvg(selector);
  const width = 900;
  const height = 420;
  const margin = { top: 20, right: 24, bottom: 62, left: 58 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const maxVal = Math.max(...rows.map((row) => Number(row[valueKey])));
  const gap = 3;
  const barW = Math.max(2, plotW / rows.length - gap);

  [0, 0.25, 0.5, 0.75, 1].forEach((p) => {
    const y = margin.top + plotH - plotH * p;
    svg.appendChild(svgEl("line", { x1: margin.left, y1: y, x2: width - margin.right, y2: y, class: "grid-line" }));
    text(svg, 12, y + 4, fmt.format(Math.round(maxVal * p)), "tick");
  });

  rows.forEach((row, idx) => {
    const val = Number(row[valueKey]);
    const h = maxVal ? (val / maxVal) * plotH : 0;
    const x = margin.left + idx * (barW + gap);
    const y = margin.top + plotH - h;
    svg.appendChild(svgEl("rect", { x, y, width: barW, height: h, rx: 3, fill: colors[idx % colors.length], opacity: 0.86 }));
    if (idx % 6 === 0) text(svg, x + barW / 2, height - 28, row[labelKey], "tick", "middle");
  });
}

function lineChart(selector, rows, xKey, yKey) {
  const svg = makeSvg(selector);
  const width = 900;
  const height = 420;
  const margin = { top: 24, right: 28, bottom: 46, left: 70 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const xs = rows.map((row) => Number(row[xKey]));
  const ys = rows.map((row) => Number(row[yKey]));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  const x = (val) => margin.left + ((val - minX) / (maxX - minX)) * plotW;
  const y = (val) => margin.top + plotH - (val / maxY) * plotH;

  [0, 0.25, 0.5, 0.75, 1].forEach((p) => {
    const yy = margin.top + plotH - plotH * p;
    svg.appendChild(svgEl("line", { x1: margin.left, y1: yy, x2: width - margin.right, y2: yy, class: "grid-line" }));
    text(svg, 14, yy + 4, fmt.format(Math.round(maxY * p)), "tick");
  });

  const d = rows.map((row, idx) => `${idx === 0 ? "M" : "L"} ${x(Number(row[xKey]))} ${y(Number(row[yKey]))}`).join(" ");
  svg.appendChild(svgEl("path", { d, fill: "none", stroke: "#b83a40", "stroke-width": 4, "stroke-linecap": "round" }));
  rows.filter((_, idx) => idx % 4 === 0).forEach((row) => {
    const cx = x(Number(row[xKey]));
    const cy = y(Number(row[yKey]));
    svg.appendChild(svgEl("circle", { cx, cy, r: 4, fill: "#b83a40" }));
    text(svg, cx, height - 18, row[xKey], "tick", "middle");
  });
}

function donut(selector, rows, labelKey, valueKey) {
  const viewHeight = Math.max(360, 130 + rows.length * 36);
  const svg = makeSvg(selector, `0 0 560 ${viewHeight}`);
  const target = typeof selector === "string" ? $(selector) : selector;
  target.style.minHeight = `${viewHeight}px`;
  const total = rows.reduce((sum, row) => sum + Number(row[valueKey]), 0);
  let start = -Math.PI / 2;
  const cx = 172;
  const cy = Math.max(170, viewHeight / 2);
  const r = rows.length > 6 ? 132 : 112;
  const inner = rows.length > 6 ? 80 : 68;
  const legendX = 368;
  const legendStart = Math.max(76, cy - (rows.length * 34) / 2);

  rows.forEach((row, idx) => {
    const angle = (Number(row[valueKey]) / total) * Math.PI * 2;
    const end = start + angle;
    const large = angle > Math.PI ? 1 : 0;
    const p1 = [cx + r * Math.cos(start), cy + r * Math.sin(start)];
    const p2 = [cx + r * Math.cos(end), cy + r * Math.sin(end)];
    const p3 = [cx + inner * Math.cos(end), cy + inner * Math.sin(end)];
    const p4 = [cx + inner * Math.cos(start), cy + inner * Math.sin(start)];
    const d = `M ${p1[0]} ${p1[1]} A ${r} ${r} 0 ${large} 1 ${p2[0]} ${p2[1]} L ${p3[0]} ${p3[1]} A ${inner} ${inner} 0 ${large} 0 ${p4[0]} ${p4[1]} Z`;
    const color = colors[idx % colors.length];
    svg.appendChild(svgEl("path", { d, fill: color }));
    const pct = Math.round((Number(row[valueKey]) / total) * 100);
    text(svg, legendX, legendStart + idx * 34 + 13, `${row[labelKey]} · ${pct}%`, "label");
    svg.appendChild(svgEl("rect", { x: legendX - 28, y: legendStart + idx * 34, width: 14, height: 14, rx: 3, fill: color }));
    start = end;
  });
  text(svg, cx, cy - 4, fmt.format(total), "label", "middle").setAttribute("font-size", "24");
  text(svg, cx, cy + 20, "записей", "tick", "middle");
}

function scatter(selector, rows, xKey, yKey, title) {
  const svg = makeSvg(selector, "0 0 520 360");
  const width = 520;
  const height = 360;
  const margin = { top: 42, right: 20, bottom: 44, left: 54 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const xs = rows.map((row) => Number(row[xKey]));
  const ys = rows.map((row) => Number(row[yKey]));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const x = (val) => margin.left + ((val - minX) / (maxX - minX)) * plotW;
  const y = (val) => margin.top + plotH - ((val - minY) / (maxY - minY)) * plotH;

  text(svg, margin.left, 24, title, "label");
  svg.appendChild(svgEl("line", { x1: margin.left, y1: margin.top + plotH, x2: width - margin.right, y2: margin.top + plotH, class: "grid-line" }));
  svg.appendChild(svgEl("line", { x1: margin.left, y1: margin.top, x2: margin.left, y2: margin.top + plotH, class: "grid-line" }));
  rows.forEach((row, idx) => {
    svg.appendChild(svgEl("circle", {
      cx: x(Number(row[xKey])),
      cy: y(Number(row[yKey])),
      r: 2.2,
      fill: colors[idx % colors.length],
      opacity: 0.42,
    }));
  });
  text(svg, margin.left, height - 12, `${xKey}: ${Math.round(minX)}-${Math.round(maxX)}`, "tick");
  text(svg, width - margin.right, height - 12, `${yKey}: ${Math.round(minY)}-${Math.round(maxY)}`, "tick", "end");
}

function table(selector, rows, columns) {
  const wrap = $(selector);
  const head = columns.map((col) => `<th>${col.label}</th>`).join("");
  const body = rows
    .map((row) => `<tr>${columns.map((col) => `<td>${row[col.key] ?? ""}</td>`).join("")}</tr>`)
    .join("");
  wrap.innerHTML = `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderKpis() {
  const kpis = [
    ["Зимние игры", value("Winter Olympic Games through 2016")],
    ["Летние игры", value("Summer Olympic Games through 2016")],
    ["Чемпионы РФ в Сочи", value("Unique Russian gold medalist athletes in Sochi 2014")],
    ["Золотые записи РФ", value("Russian gold athlete-event rows in Sochi 2014")],
  ];
  $("#kpis").innerHTML = kpis.map(([label, val]) => `<article class="kpi"><span>${label}</span><strong>${val}</strong></article>`).join("");
}

function renderLists() {
  $("#curling-list").innerHTML = data.firstCurlingGold
    .map((row) => `<div class="name-item"><strong>${row.Name}</strong><span>${row.Team} · ${row.Event}</span></div>`)
    .join("");

  $("#extremes").innerHTML = data.extremes
    .map((row) => `<div class="record"><strong>${row.Name}</strong><span>${row.Metric}: ${row.Sport}, ${row.Age} лет, ${row.Height} см, ${row.Weight} кг</span></div>`)
    .join("");
}

function drawHero() {
  const canvas = $("#hero-canvas");
  const ctx = canvas.getContext("2d");
  const resize = () => {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, "#101820");
    gradient.addColorStop(0.52, "#25343b");
    gradient.addColorStop(1, "#8c2f39");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.22;
    for (let i = 0; i < 44; i += 1) {
      const x = (i / 43) * w;
      const y = h * 0.72 - Math.sin(i * 0.55) * 48;
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(x, y, Math.max(5, w / 130), h - y);
    }
    ctx.globalAlpha = 1;
  };
  resize();
  window.addEventListener("resize", resize);
}

async function renderCode() {
  const target = $("#analysis-code");
  target.textContent = "Загружаю olympics_analysis.py...";
  try {
    let response = await fetch("olympics_analysis.py", { cache: "no-store" });
    if (!response.ok && location.pathname.includes("/site/")) {
      response = await fetch("../olympics_analysis.py", { cache: "no-store" });
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const source = await response.text();
    target.innerHTML = source
      .split("\n")
      .map((line, idx) => {
        const num = String(idx + 1).padStart(3, " ");
        return `<span class="code-line"><span class="line-number">${num}</span><span class="line-code">${escapeHtml(line) || " "}</span></span>`;
      })
      .join("");
  } catch (error) {
    target.textContent = "Не удалось загрузить код. Открой сайт через локальный сервер, например: python -m http.server 8000";
  }
}

async function revealDashboard() {
  if (!rendered) {
    rendered = true;
    renderKpis();
    renderLists();
    bars("#country-comparison", data.countryComparison, "Country group", ["Medal events"], { left: 190 });
    bars("#top-countries", data.topCountries, "NOC", ["Gold", "Silver", "Bronze"], { left: 70 });
    lineChart("#female-line", data.femaleLine, "Year", "Female_athlete_rows");
    donut("#season-donut", data.seasonParticipants, "Season", "Athlete_rows");
    columns("#age-chart", data.ageDistribution, "Age", "Athlete_rows");
    donut("#rus-sports", data.rusSummerSports, "Sport", "Medal events");
    scatter("#scatter-height-weight", data.scatter, "Height", "Weight", "Рост и вес");
    scatter("#scatter-age-weight", data.scatter, "Age", "Weight", "Возраст и вес");
    scatter("#scatter-age-height", data.scatter, "Age", "Height", "Возраст и рост");
    bars("#older-sports", data.olderSports, "Sport", ["Medals by athletes over 60"], { left: 220 });
    table("#older-champions", data.olderChampions, [
      { key: "Name", label: "Спортсмен" },
      { key: "Age", label: "Возраст" },
      { key: "NOC", label: "NOC" },
      { key: "Year", label: "Год" },
      { key: "Sport", label: "Спорт" },
    ]);
    table("#top-athletes", data.topAthletes, [
      { key: "Name", label: "Спортсмен" },
      { key: "Team", label: "Команда" },
      { key: "NOC", label: "NOC" },
      { key: "Medals", label: "Медали" },
      { key: "Gold", label: "Золото" },
    ]);
    await renderCode();
    installExpandButtons();
  }

  $("#load-screen").classList.add("is-hidden");
  $("#dashboard").hidden = false;
  $("#nav-actions").hidden = false;
  $("#load-data").classList.add("is-loaded");
  $("#load-data").textContent = "Дашборд открыт";
  $("#load-hint").textContent = "Инфографика построена из агрегатов, подготовленных Python/Pandas.";
  $("#dashboard").scrollIntoView({ behavior: "smooth", block: "start" });
}

function installExpandButtons() {
  document.querySelectorAll("#dashboard .panel, #dashboard .band").forEach((block, idx) => {
    if (!block.querySelector(".chart, .table-wrap, .name-list, .record-grid")) {
      return;
    }
    if (block.querySelector(".expand-action")) {
      return;
    }
    const title = block.querySelector(".section-title");
    if (!title) {
      return;
    }
    const wrapper = document.createElement("div");
    wrapper.className = "section-head";
    title.parentNode.insertBefore(wrapper, title);
    wrapper.appendChild(title);

    const button = document.createElement("button");
    button.className = "expand-action";
    button.type = "button";
    button.textContent = "Развернуть";
    button.addEventListener("click", () => openFocus(block, idx));
    wrapper.appendChild(button);
  });
}

function openFocus(block) {
  const modal = $("#focus-modal");
  const content = $("#focus-content");
  const heading = block.querySelector("h2")?.textContent || "Детальный просмотр";
  $("#focus-title").textContent = heading;
  content.innerHTML = "";
  content.appendChild(block.cloneNode(true));
  content.querySelectorAll(".expand-action").forEach((button) => button.remove());
  content.querySelectorAll(".section-head").forEach((head) => head.remove());
  modal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeFocus() {
  $("#focus-modal").hidden = true;
  $("#focus-content").innerHTML = "";
  document.body.classList.remove("modal-open");
}

function init() {
  drawHero();
  if (location.pathname.includes("/site/")) {
    $("#excel-link").href = "../outputs/olympics_report.xlsx";
  }
  $("#load-data").addEventListener("click", revealDashboard);
  $("#reload-code").addEventListener("click", renderCode);
  document.querySelectorAll("[data-close-focus]").forEach((el) => el.addEventListener("click", closeFocus));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !$("#focus-modal").hidden) {
      closeFocus();
    }
  });
}

init();

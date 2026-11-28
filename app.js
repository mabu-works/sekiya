"use strict";

// ==========================================
// 🪑 せきや 画面側ロジック
// 純粋な計算（検証・パース・シャッフル・結果テキスト・保存形式）は
// js/seat-core.js（window.SekiyaCore）に寄せ、ここは DOM の配線に専念する。
// ==========================================
const Core = window.SekiyaCore;
const DATA_KEY = Core.DATA_KEY;

// ==========================================
// 📊 状態
// ==========================================
let lastSeats = null; // 直近の結果（名前または null の配列、行優先）
let lastRows = 0; // 直近の結果を作ったときの縦
let lastCols = 0; // 直近の結果を作ったときの横

// ==========================================
// 🧩 DOM
// ==========================================
const $ = (id) => document.getElementById(id);
const rowsInput = $("rowsInput");
const colsInput = $("colsInput");
const seatCountEl = $("seatCount");
const gridMsg = $("gridMsg");
const namesArea = $("namesArea");
const nameCountEl = $("nameCount");
const seatArea = $("seatArea");
const shuffleBtn = $("shuffleBtn");
const reshuffleBtn = $("reshuffleBtn");
const copyResultBtn = $("copyResultBtn");
const printBtn = $("printBtn");
const shuffleMsg = $("shuffleMsg");
const copyMsg = $("copyMsg");

// ==========================================
// 💾 自動保存（名前リストと主要設定を localStorage に保存し、再訪時に復元）
// ==========================================
function saveData() {
  try {
    localStorage.setItem(DATA_KEY, Core.serializeData({
      names: namesArea.value,
      rows: rowsInput.value,
      cols: colsInput.value,
      front: selectedFront()
    }));
  } catch (e) { /* 保存できなくても通常の操作は続行できる */ }
}

function restoreData() {
  let raw = null;
  try { raw = localStorage.getItem(DATA_KEY); } catch (e) { raw = null; }
  const data = Core.parseSavedData(raw);
  if (!data) return;
  if (data.names !== null) namesArea.value = data.names;
  if (data.rows !== null) rowsInput.value = String(data.rows);
  if (data.cols !== null) colsInput.value = String(data.cols);
  if (data.front !== null) {
    document.querySelectorAll('input[name="front"]').forEach((radio) => {
      radio.checked = radio.value === data.front;
    });
  }
}

function clearData() {
  try { localStorage.removeItem(DATA_KEY); } catch (e) { /* 削除できなくてもクリア自体は有効 */ }
}

// ==========================================
// 📝 名前リスト
// ==========================================
function currentNames() {
  return Core.parseNames(namesArea.value);
}

function updateNameCount() {
  nameCountEl.textContent = String(currentNames().length);
}

namesArea.addEventListener("input", () => {
  updateNameCount();
  updateSeatCount();
  saveData();
});

$("clearBtn").addEventListener("click", () => {
  namesArea.value = "";
  clearData(); // クリアは保存データの消去手段も兼ねる（保存済みの名前・設定も消える）
  updateNameCount();
  updateSeatCount();
  namesArea.focus();
});

$("sampleBtn").addEventListener("click", () => {
  namesArea.value = Core.SAMPLE_NAMES.join("\n");
  updateNameCount();
  updateSeatCount();
  saveData();
});

// ==========================================
// 💺 座席グリッド
// ==========================================
function gridSize() {
  const rows = Number.parseInt(rowsInput.value, 10);
  const cols = Number.parseInt(colsInput.value, 10);
  return {
    rows: Number.isFinite(rows) ? rows : NaN,
    cols: Number.isFinite(cols) ? cols : NaN
  };
}

function updateSeatCount() {
  const { rows, cols } = gridSize();
  const err = Core.gridError(rows, cols);
  if (err) {
    seatCountEl.textContent = "―";
    gridMsg.textContent = err;
    return;
  }
  const total = rows * cols;
  seatCountEl.textContent = String(total);
  const names = currentNames().length;
  if (names > total) {
    gridMsg.textContent = "名前（" + names + "人）が座席数（" + total + "席）を超えています。「人数に合わせて座席を広げる」を押すか、縦・横を増やしてください。";
  } else {
    gridMsg.textContent = "";
  }
}

rowsInput.addEventListener("input", () => { updateSeatCount(); saveData(); });
colsInput.addEventListener("input", () => { updateSeatCount(); saveData(); });

// 📐 人数に合わせて座席を広げる（計算は Core.expandGrid）
$("expandBtn").addEventListener("click", () => {
  const names = currentNames().length;
  const { rows, cols } = gridSize();
  const result = Core.expandGrid(names, rows, cols);
  if (result.error) {
    gridMsg.textContent = result.error;
    return;
  }
  rowsInput.value = String(result.rows);
  colsInput.value = String(result.cols);
  updateSeatCount();
  saveData();
  gridMsg.textContent = "座席を縦" + result.rows + " × 横" + result.cols + "（" + result.rows * result.cols + "席）に広げました。";
});

function selectedFront() {
  const checked = document.querySelector('input[name="front"]:checked');
  return checked ? checked.value : "top";
}

document.querySelectorAll('input[name="front"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    saveData();
    if (lastSeats) renderSeats(lastSeats);
  });
});

// ==========================================
// 🔀 シャッフル
// ==========================================
function shuffleSeats() {
  const { rows, cols } = gridSize();
  const err = Core.gridError(rows, cols);
  if (err) {
    shuffleMsg.textContent = err;
    return;
  }
  const total = rows * cols;
  const names = currentNames();

  if (names.length === 0) {
    shuffleMsg.textContent = "名前を1人以上入れてください。";
    return;
  }
  if (names.length > total) {
    shuffleMsg.textContent = "名前（" + names.length + "人）が座席数（" + total + "席＝縦" + rows + " × 横" + cols + "）を超えています。縦・横を増やすか、「人数に合わせて座席を広げる」を押してください。";
    return;
  }

  lastSeats = Core.buildSeats(names, rows, cols);
  lastRows = rows;
  lastCols = cols;
  shuffleMsg.textContent = names.length + "人を" + total + "席に配置しました（空席" + (total - names.length) + "席）。";
  copyMsg.textContent = "";
  renderSeats(lastSeats);
  updateButtons();
}

function renderSeats(seats) {
  // 🖼️ 表示は結果を作ったときのグリッド寸法を使う（あとから設定を変えても崩れない）
  const rows = lastRows;
  const cols = lastCols;
  const front = selectedFront();

  seatArea.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "seat-wrap front-" + front;

  const banner = document.createElement("div");
  banner.className = "front-banner";
  banner.textContent = "前（黒板）";
  wrap.appendChild(banner);

  const grid = document.createElement("div");
  grid.className = "seat-grid";
  grid.style.gridTemplateColumns = "repeat(" + cols + ", 1fr)";

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const name = seats[r * cols + c];
      const cell = document.createElement("div");
      if (name === null || name === undefined) {
        cell.className = "seat-cell is-empty";
        cell.textContent = "空席";
      } else {
        cell.className = "seat-cell";
        cell.textContent = name;
      }
      grid.appendChild(cell);
    }
  }
  wrap.appendChild(grid);
  seatArea.appendChild(wrap);
}

function updateButtons() {
  const has = lastSeats !== null;
  reshuffleBtn.disabled = !has;
  copyResultBtn.disabled = !has;
  if (printBtn) printBtn.disabled = !has;
}

shuffleBtn.addEventListener("click", shuffleSeats);
reshuffleBtn.addEventListener("click", shuffleSeats);

// ==========================================
// 📋 結果コピー（座席表の並びを保ったテキスト）
// ==========================================
copyResultBtn.addEventListener("click", async () => {
  if (lastSeats === null) return;
  const text = Core.resultText(lastSeats, lastRows, lastCols, selectedFront());
  try {
    await navigator.clipboard.writeText(text);
    copyMsg.textContent = "結果をコピーしました。";
  } catch (e) {
    copyMsg.textContent = text;
  }
});

// ==========================================
// 🖨️ 印刷（座席表だけを印刷する。レイアウトは style.css の @media print）
// ==========================================
if (printBtn) {
  printBtn.addEventListener("click", () => {
    if (lastSeats === null) return;
    window.print();
  });
}

// ==========================================
// 🚀 初期化
// ==========================================
restoreData();
updateNameCount();
updateSeatCount();
updateButtons();

// ==========================================
// 🌙 テーマ（ダーク既定＋ライト切り替え）
// ==========================================
(function initTheme() {
  var root = document.documentElement;
  if (!root || !root.getAttribute || !root.setAttribute) return;
  function apply(theme) {
    root.setAttribute("data-theme", theme);
    var btn = document.getElementById("themeToggle");
    if (btn) btn.textContent = theme === "light" ? "☀️" : "🌙";
  }
  var current = root.getAttribute("data-theme");
  if (current !== "light" && current !== "dark") {
    try { current = localStorage.getItem(Core.THEME_KEY); } catch (e) { current = null; }
  }
  apply(current === "light" ? "light" : "dark");
  var btn = document.getElementById("themeToggle");
  if (btn && btn.addEventListener) {
    btn.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      apply(next);
      try { localStorage.setItem(Core.THEME_KEY, next); } catch (e) { /* 保存できなくても切り替え自体は有効 */ }
    });
  }
})();

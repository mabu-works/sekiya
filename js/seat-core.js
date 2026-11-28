"use strict";

// ==========================================
// 🧮 せきや コアロジック（DOM 非依存）
// 座席グリッドの検証、名前のパース、シャッフル、
// 自動拡張、結果テキスト生成、保存データの検証を担う。
// ブラウザでは window.SekiyaCore、Node では module.exports として使う。
// ==========================================
(function (global) {

// 🔢 グリッド寸法の範囲（縦・横それぞれ）
const MIN_SIZE = 1;
const MAX_SIZE = 20;

// 🎲 サンプル名（一般的な姓のみ。実在の名簿は入れない）
const SAMPLE_NAMES = ["田中", "佐藤", "鈴木", "高橋", "伊藤", "渡辺", "山本", "中村", "小林", "加藤", "吉田", "山田"];

// 🧭 前（黒板）の向きと、その日本語ラベル
const FRONT_LABELS = {
top: "上",
bottom: "下",
left: "左",
right: "右"
};
const FRONT_VALUES = Object.keys(FRONT_LABELS);

// 💾 localStorage のキー（テーマ用キーとは分ける）
const DATA_KEY = "sekiya-data";
const THEME_KEY = "sekiya-theme";

// ------------------------------------------
// 📝 名前リストのパース
// 1行に1人。前後の空白を取り除き、空行は無視する。
// 同名は別々の人として扱うため、重複はそのまま残す。
// ------------------------------------------
function parseNames(text) {
const names = [];
String(text == null? "": text).split(/\r?\n/).forEach((line) => {
const name = line.trim();
if (name!== "") names.push(name);
});
return names;
}

// ------------------------------------------
// ⚠️ グリッド寸法の検証
// 問題がなければ ""、あれば利用者向けの日本語メッセージを返す。
// rows / cols は数値（未入力なら NaN）を想定する。
// ------------------------------------------
function gridError(rows, cols) {
if (!Number.isFinite(rows) ||!Number.isFinite(cols)) {
return "縦と横には数字を入力してください。";
}
if (rows < MIN_SIZE || rows > MAX_SIZE || cols < MIN_SIZE || cols > MAX_SIZE) {
return "縦と横はそれぞれ" + MIN_SIZE + "〜" + MAX_SIZE + "の範囲で指定してください（現在：縦" + rows + " × 横" + cols + "）。";
}
return "";
}

// ------------------------------------------
// 🔀 Fisher-Yates シャッフル（元配列は変更しない）
// rng は [0, 1) の乱数を返す関数。テストでは差し替え可能。
// ------------------------------------------
function shuffledCopy(list, rng) {
const rand = typeof rng === "function"? rng: Math.random;
const arr = list.slice();
for (let i = arr.length - 1; i > 0; i--) {
const j = Math.floor(rand() * (i + 1));
const tmp = arr[i];
arr[i] = arr[j];
arr[j] = tmp;
}
return arr;
}

// ------------------------------------------
// 💺 座席配列の構築
// シャッフルした名前を行優先で並べ、余った席は null（空席）にする。
// 呼び出し側で「名前0人」「座席数超過」の検証を済ませている前提。
// ------------------------------------------
function buildSeats(names, rows, cols, rng) {
const total = rows * cols;
const shuffled = shuffledCopy(names, rng);
const seats = [];
for (let i = 0; i < total; i++) {
seats.push(i < shuffled.length? shuffled[i]: null);
}
return seats;
}

// ------------------------------------------
// 📐 人数に合わせてグリッドを広げる計算
// 横（列数）を保ったまま縦（行数）を増やし、縦が上限を超える場合は横も増やす。
// 戻り値: { rows, cols} または { error: メッセージ}
// ------------------------------------------
function expandGrid(nameCount, rows, cols) {
if (nameCount === 0) {
return { error: "先に名前を1人以上入れてください。"};
}
let r = Number.isFinite(rows) && rows >= MIN_SIZE? rows: MIN_SIZE;
let c = Number.isFinite(cols) && cols >= MIN_SIZE? cols: MIN_SIZE;
if (c > MAX_SIZE) c = MAX_SIZE;
r = Math.ceil(nameCount / c);
if (r > MAX_SIZE) {
r = MAX_SIZE;
c = Math.ceil(nameCount / r);
}
if (r * c < nameCount) {
return { error: "最大サイズ（縦" + MAX_SIZE + " × 横" + MAX_SIZE + "）でも" + nameCount + "人は入りきりません。名前を減らしてください。"};
}
return { rows: r, cols: c};
}

// ------------------------------------------
// 📋 結果コピー用テキスト
// セルは「 ｜ 」区切り、空席は「（空席）」。
// 前が上なら先頭行、下なら末尾行に「」を付け、
// 左・右なら見出し行＋各行の端に「前」を付ける。
// ------------------------------------------
function resultText(seats, rows, cols, front) {
const lines = [];
const rowLine = (r) => {
const cells = [];
for (let c = 0; c < cols; c++) {
const name = seats[r * cols + c];
cells.push(name === null || name === undefined? "（空席）": name);
}
return cells.join(" ｜ ");
};

if (front === "top") lines.push("");
if (front === "left" || front === "right") {
lines.push("");
}
for (let r = 0; r < rows; r++) {
let line = rowLine(r);
if (front === "left") line = "前｜ " + line;
if (front === "right") line = line + " ｜前";
lines.push(line);
}
if (front === "bottom") lines.push("");
return lines.join("\n");
}

// ------------------------------------------
// 💾 自動保存データの整形と検証
// 保存形式: { names: 文字列, rows: 文字列, cols: 文字列, front: 向き}
// 復元時は各値を検証し、不正な項目は初期値に落とす。
// ------------------------------------------
function serializeData(state) {
return JSON.stringify({
names: state.names,
rows: state.rows,
cols: state.cols,
front: state.front
});
}

function parseSavedData(raw) {
let data = null;
try {
data = typeof raw === "string"? JSON.parse(raw): null;
} catch (e) {
data = null;
}
if (!data || typeof data!== "object") return null;

const restored = { names: null, rows: null, cols: null, front: null};
if (typeof data.names === "string") restored.names = data.names;

const rows = Number.parseInt(data.rows, 10);
if (Number.isFinite(rows) && rows >= MIN_SIZE && rows <= MAX_SIZE) restored.rows = rows;
const cols = Number.parseInt(data.cols, 10);
if (Number.isFinite(cols) && cols >= MIN_SIZE && cols <= MAX_SIZE) restored.cols = cols;

if (Object.prototype.hasOwnProperty.call(FRONT_LABELS, data.front)) {
restored.front = data.front;
}
return restored;
}

const api = {
MIN_SIZE,
MAX_SIZE,
SAMPLE_NAMES,
FRONT_LABELS,
FRONT_VALUES,
DATA_KEY,
THEME_KEY,
parseNames,
gridError,
shuffledCopy,
buildSeats,
expandGrid,
resultText,
serializeData,
parseSavedData
};

if (typeof module!== "undefined" && module.exports) {
module.exports = api;
}
global.SekiyaCore = api;

})(typeof window!== "undefined"? window: globalThis);

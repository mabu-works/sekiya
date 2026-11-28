"use strict";

// 🧪 せきや コアロジックの単体テスト（node:test、依存なし）
// 実行: npm test

const test = require("node:test");
const assert = require("node:assert/strict");
const Core = require("../js/seat-core.js");

// 🎲 決定的な乱数（mulberry32）。同じシードでは同じ順序になることを利用する
function seededRng(seed) {
let a = seed >>> 0;
return function () {
a |= 0; a = (a + 0x6D2B79F5) | 0;
let t = Math.imul(a ^ (a >>> 15), 1 | a);
t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
}

function multiset(list) {
const map = new Map();
for (const item of list) map.set(item, (map.get(item) || 0) + 1);
return map;
}

// ==========================================
// 📌 定数
// ==========================================
test("constants: keys, sizes and sample names are pinned", () => {
assert.equal(Core.DATA_KEY, "sekiya-data");
assert.equal(Core.THEME_KEY, "sekiya-theme");
assert.equal(Core.MIN_SIZE, 1);
assert.equal(Core.MAX_SIZE, 20);
assert.equal(Core.SAMPLE_NAMES.length, 12);
assert.deepEqual(Core.FRONT_VALUES, ["top", "bottom", "left", "right"]);
assert.equal(Core.FRONT_LABELS.left, "左");
});

// ==========================================
// 📝 parseNames
// ==========================================
test("parseNames: trims lines and skips blank lines", () => {
assert.deepEqual(Core.parseNames(" 田中 \n\n佐藤\n \n鈴木 "), ["田中", "佐藤", "鈴木"]);
});

test("parseNames: handles CRLF and keeps duplicate names as distinct people", () => {
assert.deepEqual(Core.parseNames("田中\r\n田中\r\n佐藤"), ["田中", "田中", "佐藤"]);
});

test("parseNames: empty or null input gives an empty list", () => {
assert.deepEqual(Core.parseNames(""), []);
assert.deepEqual(Core.parseNames("\n\n"), []);
assert.deepEqual(Core.parseNames(null), []);
});

// ==========================================
// ⚠️ gridError
// ==========================================
test("gridError: non-numeric input asks for numbers", () => {
assert.equal(Core.gridError(NaN, 6), "縦と横には数字を入力してください。");
assert.equal(Core.gridError(6, NaN), "縦と横には数字を入力してください。");
});

test("gridError: out-of-range input reports the current values", () => {
assert.equal(
Core.gridError(0, 6),
"縦と横はそれぞれ1〜20の範囲で指定してください（現在：縦0 × 横6）。"
);
assert.equal(
Core.gridError(6, 21),
"縦と横はそれぞれ1〜20の範囲で指定してください（現在：縦6 × 横21）。"
);
});

test("gridError: boundary and normal sizes pass", () => {
assert.equal(Core.gridError(1, 1), "");
assert.equal(Core.gridError(6, 6), "");
assert.equal(Core.gridError(20, 20), "");
});

// ==========================================
// 🔀 shuffledCopy
// ==========================================
test("shuffledCopy: result is a permutation and the input is not mutated", () => {
const input = ["a", "b", "c", "d", "e", "f", "g", "h"];
const snapshot = input.slice();
const out = Core.shuffledCopy(input, seededRng(42));
assert.deepEqual(input, snapshot);
assert.deepEqual(multiset(out), multiset(snapshot));
assert.equal(out.length, input.length);
});

test("shuffledCopy: same seed reproduces the same order", () => {
const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
assert.deepEqual(Core.shuffledCopy(input, seededRng(7)), Core.shuffledCopy(input, seededRng(7)));
});

test("shuffledCopy: rng returning 0 rotates deterministically (Fisher-Yates trace)", () => {
// j は常に 0: 末尾から先頭要素と交換していく既知の並びになる
assert.deepEqual(Core.shuffledCopy([1, 2, 3, 4], () => 0), [2, 3, 4, 1]);
});

// ==========================================
// 💺 buildSeats の不変条件
// ==========================================
test("buildSeats: everyone is seated exactly once, leftovers are empty seats", () => {
const cases = [
{ names: ["田中"], rows: 1, cols: 1},
{ names: Core.SAMPLE_NAMES, rows: 6, cols: 6},
{ names: ["田中", "田中", "佐藤"], rows: 2, cols: 3},
{ names: Array.from({ length: 40}, (_, i) => "生徒" + (i + 1)), rows: 5, cols: 8},
{ names: Array.from({ length: 400}, (_, i) => "n" + i), rows: 20, cols: 20}
];
for (const { names, rows, cols} of cases) {
const seats = Core.buildSeats(names, rows, cols, seededRng(1234));
assert.equal(seats.length, rows * cols, "seat count");
const seated = seats.filter((s) => s!== null);
assert.deepEqual(multiset(seated), multiset(names), "each person exactly as often as listed");
assert.equal(seats.length - seated.length, rows * cols - names.length, "empty seat count");
// 名前は先頭から names.length 個の席に詰められ、残りが空席になる
assert.ok(seats.slice(0, names.length).every((s) => s!== null));
assert.ok(seats.slice(names.length).every((s) => s === null));
}
});

test("buildSeats: full grid has no empty seats", () => {
const names = Array.from({ length: 36}, (_, i) => "n" + i);
const seats = Core.buildSeats(names, 6, 6, seededRng(9));
assert.ok(seats.every((s) => s!== null));
});

// ==========================================
// 📐 expandGrid（レイアウト計算）
// ==========================================
test("expandGrid: no names is an error", () => {
assert.deepEqual(Core.expandGrid(0, 6, 6), { error: "先に名前を1人以上入れてください。"});
});

test("expandGrid: keeps columns and grows rows", () => {
assert.deepEqual(Core.expandGrid(36, 6, 6), { rows: 6, cols: 6});
assert.deepEqual(Core.expandGrid(37, 6, 6), { rows: 7, cols: 6});
assert.deepEqual(Core.expandGrid(40, 6, 6), { rows: 7, cols: 6});
assert.deepEqual(Core.expandGrid(1, 6, 6), { rows: 1, cols: 6});
});

test("expandGrid: grows columns once rows hit the cap", () => {
assert.deepEqual(Core.expandGrid(130, 6, 6), { rows: 20, cols: 7});
assert.deepEqual(Core.expandGrid(400, 6, 6), { rows: 20, cols: 20});
});

test("expandGrid: beyond the maximum grid the column count overflows (pinned quirk)", () => {
// 元実装の計算式では、縦を上限20に固定したあと横 = ceil(人数/20) になるため、
// 401人以上では横が上限を超える。「入りきりません」のエラー分岐には到達しない
// （20 × ceil(n/20) は常に対象人数以上になる）。元実装どおりの挙動を固定する。
assert.deepEqual(Core.expandGrid(401, 6, 6), { rows: 20, cols: 21 });
assert.deepEqual(Core.expandGrid(1000, 6, 6), { rows: 20, cols: 50 });
});

test("expandGrid: invalid dimensions fall back to the minimum", () => {
assert.deepEqual(Core.expandGrid(10, NaN, NaN), { rows: 10, cols: 1});
assert.deepEqual(Core.expandGrid(10, 0, 25), { rows: 1, cols: 20});
});

test("expandGrid: result always fits the requested number of people", () => {
for (let n = 1; n <= 400; n += 17) {
const { rows, cols} = Core.expandGrid(n, 6, 6);
assert.ok(rows >= 1 && rows <= 20 && cols >= 1 && cols <= 20);
assert.ok(rows * cols >= n, n + " people fit in " + rows + "x" + cols);
}
});

// ==========================================
// 📋 resultText
// ==========================================
const SEATS_2x3 = ["田中", "佐藤", null, "鈴木", "高橋", "伊藤"];

test("resultText: front on top puts the banner line first", () => {
assert.equal(
Core.resultText(SEATS_2x3, 2, 3, "top"),
"\n田中 ｜ 佐藤 ｜ （空席）\n鈴木 ｜ 高橋 ｜ 伊藤"
);
});

test("resultText: front on bottom puts the banner line last", () => {
assert.equal(
Core.resultText(SEATS_2x3, 2, 3, "bottom"),
"田中 ｜ 佐藤 ｜ （空席）\n鈴木 ｜ 高橋 ｜ 伊藤\n"
);
});

test("resultText: front on the left adds a header and row prefixes", () => {
assert.equal(
Core.resultText(SEATS_2x3, 2, 3, "left"),
"\n前｜ 田中 ｜ 佐藤 ｜ （空席）\n前｜ 鈴木 ｜ 高橋 ｜ 伊藤"
);
});

test("resultText: front on the right adds a header and row suffixes", () => {
assert.equal(
Core.resultText(SEATS_2x3, 2, 3, "right"),
"\n田中 ｜ 佐藤 ｜ （空席） ｜前\n鈴木 ｜ 高橋 ｜ 伊藤 ｜前"
);
});

// ==========================================
// 💾 保存データの形式（serializeData / parseSavedData）
// ==========================================
test("saved data: serialize produces the pinned JSON shape", () => {
const raw = Core.serializeData({ names: "田中\n佐藤", rows: "6", cols: "5", front: "left"});
assert.deepEqual(JSON.parse(raw), { names: "田中\n佐藤", rows: "6", cols: "5", front: "left"});
});

test("saved data: round-trip restores validated values", () => {
const raw = Core.serializeData({ names: "田中", rows: "7", cols: "5", front: "bottom"});
assert.deepEqual(Core.parseSavedData(raw), { names: "田中", rows: 7, cols: 5, front: "bottom"});
});

test("saved data: numeric rows/cols in JSON are accepted", () => {
assert.deepEqual(
Core.parseSavedData('{"names":"x","rows":8,"cols":4,"front":"right"}'),
{ names: "x", rows: 8, cols: 4, front: "right"}
);
});

test("saved data: broken or non-object payloads restore nothing", () => {
assert.equal(Core.parseSavedData("{not json"), null);
assert.equal(Core.parseSavedData("42"), null);
assert.equal(Core.parseSavedData(null), null);
assert.equal(Core.parseSavedData(""), null);
});

test("saved data: invalid fields fall back to null per field", () => {
assert.deepEqual(
Core.parseSavedData('{"names":123,"rows":0,"cols":21,"front":"up"}'),
{ names: null, rows: null, cols: null, front: null}
);
assert.deepEqual(
Core.parseSavedData('{"names":"田中","rows":"abc","cols":6,"front":"top"}'),
{ names: "田中", rows: null, cols: 6, front: "top"}
);
});

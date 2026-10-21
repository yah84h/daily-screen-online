import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
async function load(path) {
  const text = await readFile(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(text, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });
  return import(
    "data:text/javascript;base64," + Buffer.from(outputText).toString("base64")
  );
}
const { periodAt, validTimetable, defaultTimetable, recognitionOf } =
  await load("../src/lib/loop.ts");
const { techEntries, techEntryForDay } = await load("../src/lib/techQuotes.ts");
const at = (date, time) => new Date(`${date}T${time}:00+03:00`);
test("Jeddah boundaries, third-period break and Thursday early finish", () => {
  assert.equal(periodAt(at("2026-10-21", "06:59")).label, "حياكم الله");
  assert.equal(periodAt(at("2026-10-21", "07:00")).label, "الحصة الأولى");
  assert.equal(periodAt(at("2026-10-21", "07:45")).label, "بين الحصص");
  assert.equal(periodAt(at("2026-10-21", "07:46")).label, "الحصة الثانية");
  assert.equal(periodAt(at("2026-10-21", "09:17")).label, "الفسحة");
  assert.equal(periodAt(at("2026-10-21", "09:18")).label, "الحصة الرابعة");
  assert.equal(periodAt(at("2026-10-21", "11:36")).label, "الحصة السابعة");
  assert.equal(periodAt(at("2026-10-21", "12:21")).label, "الصلاه / صرفه");
  assert.equal(periodAt(at("2026-10-22", "11:35")).label, "الصلاه / صرفه");
  assert.equal(periodAt(at("2026-10-23", "09:00")).label, "حياكم الله");
});
test("custom timetable rejects overlap and moves the break", () => {
  assert(validTimetable(defaultTimetable));
  const overlap = structuredClone(defaultTimetable);
  overlap.periods[1][0] = "07:40";
  assert(!validTimetable(overlap));
  const longer = structuredClone(defaultTimetable);
  longer.periods[3][0] = "09:30";
  assert(validTimetable(longer));
  assert.equal(periodAt(at("2026-10-21", "09:25"), longer).label, "الفسحة");
  assert.equal(
    periodAt(at("2026-10-21", "07:00"), { periods: [] }).label,
    "الحصة الأولى",
  );
});
test("legacy template defaults to a hidden empty board and hiding preserves entries", () => {
  assert.equal(recognitionOf({}).enabled, false);
  assert.deepEqual(recognitionOf({}).students, []);
  const board = {
    ...recognitionOf({}),
    enabled: false,
    students: [{ id: "a", name: "طالب", achievement: "الأول" }],
  };
  assert.equal(recognitionOf({ recognition: board }).students[0].name, "طالب");
});
test("120 offline tech entries include translated sourced quotes and original tips", () => {
  assert.equal(techEntries.length, 120);
  assert.equal(new Set(techEntries.map((e) => e.id)).size, 120);
  assert.equal(techEntries.filter((e) => e.kind === "quote").length, 12);
  assert.equal(techEntries.filter((e) => e.kind === "tip").length, 108);
  for (const entry of techEntries) {
    assert(entry.text.trim());
    assert.match(entry.source, /^https:\/\//);
    if (entry.kind === "quote") {
      assert(entry.author);
      assert(entry.original);
    }
  }
  const days = Array.from(
    { length: 120 },
    (_, i) => techEntryForDay(new Date(Date.UTC(2026, 0, 1 + i, 12))).id,
  );
  assert.equal(new Set(days).size, 120);
  assert.equal(
    techEntryForDay(new Date("2026-10-20T21:00:00Z")).id,
    techEntryForDay(new Date("2026-10-21T20:59:59Z")).id,
  );
});

test("per-screen dismissal text and bounded board dimensions",()=>{
 assert.equal(periodAt(at("2026-10-21","12:21"),defaultTimetable,{dismissalLabel:"انتهى اليوم",dismissalDetail:"إلى اللقاء"}).label,"انتهى اليوم");
 assert.equal(periodAt(at("2026-10-22","11:35"),defaultTimetable,{dismissalLabel:"صرف الطلاب"}).label,"صرف الطلاب");
 assert.equal(periodAt(at("2026-10-21","07:00"),defaultTimetable,{dismissalLabel:"صرف الطلاب"}).label,"الحصة الأولى");
 assert.equal(periodAt(at("2026-10-21","12:21"),defaultTimetable,{dismissalLabel:"  "}).label,"الصلاه / صرفه");
 assert.equal(recognitionOf({recognition:{width:999,height:1,students:[]}}).width,34);
 assert.equal(recognitionOf({recognition:{width:999,height:1,students:[]}}).height,28);
});

test('recognition styles keep legacy defaults and constrain group layouts',()=>{
 assert.equal(recognitionOf({}).style,'classic');
 assert.equal(recognitionOf({recognition:{style:'solo',students:[]}}).style,'solo');
 const group=recognitionOf({recognition:{style:'group',groupSize:4,height:28,students:[]}});
 assert.equal(group.groupSize,4);assert.equal(group.height,38);
 assert.equal(recognitionOf({recognition:{style:'unknown',groupSize:99,students:[]}}).style,'classic');
 assert.equal(recognitionOf({recognition:{groupSize:99,students:[]}}).groupSize,2);
});

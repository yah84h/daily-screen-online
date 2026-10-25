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
const { periodAt, lessonCountdown, validTimetable, defaultTimetable, winterTimetable, timetableFor, timetableSeasonOf, recognitionOf } =
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
 assert.equal(recognitionOf({recognition:{width:999,height:1,students:[]}}).height,44);
});

test('recognition styles keep legacy defaults and constrain group layouts',()=>{
 assert.equal(recognitionOf({}).style,'classic');
 assert.equal(recognitionOf({recognition:{style:'solo',students:[]}}).style,'solo');
 const group=recognitionOf({recognition:{style:'group',groupSize:4,height:28,students:[]}});
 assert.equal(group.groupSize,4);assert.equal(group.height,44);
 assert.equal(recognitionOf({recognition:{style:'unknown',groupSize:99,students:[]}}).style,'classic');
 assert.equal(recognitionOf({recognition:{groupSize:99,students:[]}}).groupSize,2);
});

test('break uses exact saved boundaries and lasts until fourth starts',()=>{
 const custom={periods:defaultTimetable.periods.map(p=>[...p])};custom.periods[2][1]='09:00';custom.periods[3][0]='09:18';
 assert.equal(periodAt(new Date('2026-10-21T08:59:59+03:00'),custom).label,'الحصة الثالثة');
 for(const time of ['09:00:00','09:10:30','09:17:59']) assert.equal(periodAt(new Date('2026-10-21T'+time+'+03:00'),custom).label,'الفسحة');
 assert.equal(periodAt(new Date('2026-10-21T09:18:00+03:00'),custom).label,'الحصة الرابعة');
 assert.equal(periodAt(new Date('2026-10-21T09:17:59+03:00')).label,'الفسحة');
});

test('countdown ticks in seconds and disappears during breaks and outside lessons',()=>{
 assert.deepEqual(lessonCountdown(new Date('2026-10-21T07:00:00+03:00')),{remaining:2700,duration:2700,label:'45:00'});
 assert.equal(lessonCountdown(new Date('2026-10-21T07:44:59+03:00')).label,'00:01');
 assert.equal(lessonCountdown(new Date('2026-10-21T07:45:00+03:00')),null);
 assert.equal(lessonCountdown(new Date('2026-10-21T09:17:30+03:00')),null);
 assert.equal(lessonCountdown(new Date('2026-10-22T11:36:00+03:00')),null);
 assert.equal(lessonCountdown(new Date('2026-10-23T07:15:00+03:00')),null);
});

test('class meter restarts for each lesson using that lesson duration',()=>{
 assert.equal(lessonCountdown(new Date('2026-10-22T10:11:05+03:00')).label,'37:55');
 assert.equal(lessonCountdown(new Date('2026-10-22T10:48:59+03:00')).remaining,1);
 assert.equal(lessonCountdown(new Date('2026-10-22T10:50:00+03:00')).label,'45:00');
 const custom={periods:defaultTimetable.periods.map(p=>[...p])};custom.periods[5]=['10:50','11:20'];
 assert.equal(lessonCountdown(new Date('2026-10-22T10:50:00+03:00'),custom).duration,1800);
});

test('summer/winter shift every class exactly thirty minutes without cumulative shifts',()=>{for(let i=0;i<7;i++)for(let side=0;side<2;side++){const m=v=>Number(v.slice(0,2))*60+Number(v.slice(3));assert.equal(m(winterTimetable.periods[i][side])-m(defaultTimetable.periods[i][side]),30);}assert.equal(timetableSeasonOf({timetable:defaultTimetable}),'summer');assert.equal(timetableFor({timetableSeason:'winter'}).periods[0][0],'07:30');assert.equal(periodAt(new Date('2026-10-25T07:15:00+03:00'),winterTimetable).label,'حياكم الله');assert.equal(periodAt(new Date('2026-10-25T07:30:00+03:00'),winterTimetable).label,'الحصة الأولى');assert.equal(periodAt(new Date('2026-10-25T09:47:00+03:00'),winterTimetable).label,'الفسحة');assert.equal(lessonCountdown(new Date('2026-10-25T07:30:00+03:00'),winterTimetable).label,'45:00');assert.equal(periodAt(new Date('2026-10-29T12:05:00+03:00'),winterTimetable).label,'الصلاه / صرفه');});

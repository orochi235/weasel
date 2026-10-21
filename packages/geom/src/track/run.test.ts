import { describe, expect, test } from "vitest";
import type { Point } from "../paths/cubicMath";
import { arcShape } from "./arc";
import { trackRun } from "./run";
import { lineShape } from "./shape";

const close = (p: Point, q: Point) => {
	expect(p.x).toBeCloseTo(q.x);
	expect(p.y).toBeCloseTo(q.y);
};
const C = { x: 0, y: 0 };

describe("trackRun", () => {
	test("a left-to-right line is its own run", () => {
		const r = trackRun(lineShape({ x: 0, y: 0 }, { x: 100, y: 0 }));
		expect([r.flipped, r.reversed]).toEqual([false, false]);
		expect(r.at(0.5).angle).toBeCloseTo(0);
		expect(r.length).toBe(100);
	});
	test("a right-to-left line flips and reverses, so it still reads left to right, upright", () => {
		const r = trackRun(lineShape({ x: 100, y: 0 }, { x: 0, y: 0 }));
		expect([r.flipped, r.reversed]).toEqual([true, true]);
		close(r.at(0).point, { x: 0, y: 0 });
		expect(r.at(0.5).angle).toBeCloseTo(0);
	});
	test("a run along the top reads left to right with each item tipped to the curve", () => {
		const r = trackRun(
			arcShape({ center: C, radius: 100, start: 300, end: 60 }),
		);
		expect([r.flipped, r.reversed]).toEqual([false, false]);
		expect(r.at(0).point.x).toBeLessThan(0);
		expect(r.at(0).angle).toBeCloseTo(-60);
		expect(r.at(0.5).angle).toBeCloseTo(0);
	});
	test("a run along the bottom flips: upright, left to right, up toward the center", () => {
		const r = trackRun(
			arcShape({ center: C, radius: 100, start: 120, end: 240 }),
		);
		expect([r.flipped, r.reversed]).toEqual([true, true]);
		const p = r.at(0);
		expect(p.point.x).toBeLessThan(0);
		expect(r.at(0.5).angle).toBeCloseTo(0);
		expect(
			p.normal.x * (C.x - p.point.x) + p.normal.y * (C.y - p.point.y),
		).toBeGreaterThan(0);
	});
	test("an arc's direction does not change where a run places things", () => {
		const cw = trackRun(
			arcShape({ center: C, radius: 100, start: 120, end: 240 }),
		);
		const ccw = trackRun(
			arcShape({
				center: C,
				radius: 100,
				start: 240,
				end: 120,
				direction: "ccw",
			}),
		);
		for (const g of [0, 0.3, 1]) close(ccw.at(g).point, cw.at(g).point);
	});
	test("a run centered at 3 o'clock reads top to bottom and one at 9 bottom to top, neither flipped", () => {
		const east = trackRun(
			arcShape({ center: C, radius: 100, start: 30, end: 150 }),
		);
		const west = trackRun(
			arcShape({ center: C, radius: 100, start: 210, end: 330 }),
		);
		expect([east.flipped, west.flipped]).toEqual([false, false]);
		expect(east.at(0.5).angle).toBeCloseTo(90);
		expect(west.at(0.5).angle).toBeCloseTo(-90);
	});
	test("a sub-run measures its own stretch and clamps nearest to its ends", () => {
		const shape = arcShape({ center: C, radius: 100, start: 300, end: 60 });
		const r = trackRun(shape, 0.25, 0.75);
		expect(r.length).toBeCloseTo(shape.length / 2);
		expect(r.nearest(shape.at(0).point).f).toBe(0);
		expect(r.nearest(shape.at(1).point).f).toBe(1);
	});
	test("nearest answers in reading order", () => {
		const r = trackRun(
			arcShape({ center: C, radius: 100, start: 120, end: 240 }),
		);
		expect(r.nearest({ x: -86.6025, y: 50 }).f).toBeCloseTo(0);
	});
});

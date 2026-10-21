import { describe, expect, test } from "vitest";
import { arcShape } from "./arc";
import { trackShapeD } from "./pathData";
import { lineShape } from "./shape";

const C = { x: 0, y: 0 };

describe("trackShapeD", () => {
	test("a line is one segment", () => {
		expect(trackShapeD(lineShape({ x: 0, y: 12 }, { x: 200, y: 12 }))).toBe(
			"M 0 12 L 200 12",
		);
	});
	test("a clockwise quarter is one small arc, sweep flag 1", () => {
		expect(
			trackShapeD(arcShape({ center: C, radius: 100, start: 0, end: 90 })),
		).toBe("M 0 -100 A 100 100 0 0 1 100 0");
	});
	test("over half a turn sets the large-arc flag, and counterclockwise clears the sweep flag", () => {
		expect(
			trackShapeD(
				arcShape({
					center: C,
					radius: 100,
					start: 0,
					end: 90,
					direction: "ccw",
				}),
			),
		).toBe("M 0 -100 A 100 100 0 1 0 100 0");
	});
	test("a stretch of an arc draws only that stretch", () => {
		expect(
			trackShapeD(
				arcShape({ center: C, radius: 100, start: 0, end: 180 }),
				0,
				0.5,
			),
		).toBe("M 0 -100 A 100 100 0 0 1 100 0");
	});
	test("a whole circle is two half arcs", () => {
		expect(
			trackShapeD(arcShape({ center: C, radius: 10, start: 0, end: 0 })),
		).toBe("M 0 -10 A 10 10 0 0 1 0 10 A 10 10 0 0 1 0 -10");
	});
	test("a shape of unknown kind is sampled into a polyline", () => {
		const d = trackShapeD({
			...lineShape({ x: 0, y: 0 }, { x: 64, y: 0 }),
			kind: "path",
		});
		expect(d.startsWith("M 0 0 L 1 0 L 2 0")).toBe(true);
		expect(d.endsWith("L 64 0")).toBe(true);
	});
});

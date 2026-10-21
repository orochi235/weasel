import type { View } from "core/viewport/view";
import { viewportWorldRect } from "core/viewport/viewportWorldRect";
import { describe, expect, it } from "vitest";
import { aimSpace2d, isRectAim, rectAim, viewForAim } from "./aim";

const CAM: View = { x: 0, y: 0, scale: { x: 0.25, y: 0.25 } };
const PIP = { width: 140, height: 105 };

describe("rect aim", () => {
	it("projects a 2D aim through a target camera", () => {
		expect(
			rectAim(null, { x: 0, y: 0, width: 400, height: 300 }).outlineIn(
				aimSpace2d("pip", CAM, PIP),
			),
		).toEqual([
			{ x: 0, y: 0 },
			{ x: 100, y: 0 },
			{ x: 100, y: 75 },
			{ x: 0, y: 75 },
		]);
	});

	it("pans by the world distance between two frame points", () => {
		const moved = rectAim(null, {
			x: 0,
			y: 0,
			width: 400,
			height: 300,
		}).pannedIn(
			aimSpace2d("pip", CAM, PIP),
			{ x: 50, y: 20 },
			{ x: 60, y: 30 },
		);
		expect(moved!.extent).toEqual({ x: 40, y: 40, width: 400, height: 300 });
		expect(moved!.viewId).toBeNull();
	});

	it("unprojects to a point with no z, and ignores z when projecting", () => {
		const s = aimSpace2d(
			null,
			{ x: 10, y: 20, scale: { x: 2, y: 2 } },
			{ width: 100, height: 100 },
		);
		expect(s.unproject({ x: 4, y: 6 })).toEqual({ x: 12, y: 23 });
		expect(s.project({ x: 12, y: 23, z: 99 })).toEqual({ x: 4, y: 6 });
	});

	it("tells a rect aim from another kind", () => {
		const r = rectAim(null, { x: 0, y: 0, width: 1, height: 1 });
		expect(isRectAim(r)).toBe(true);
		expect(isRectAim({ ...r, kind: "frustum" })).toBe(false);
	});
});

describe("viewForAim", () => {
	it("inverts viewportWorldRect exactly", () => {
		const v: View = { x: -15, y: 20, scale: { x: 2, y: 0.5 } };
		const size = { width: 200, height: 100 };
		expect(viewForAim(viewportWorldRect(v, size), size, "exact")).toEqual(v);
	});

	it("fits uniformly and centered under contain", () => {
		expect(
			viewForAim(
				{ x: 10, y: 20, width: 50, height: 50 },
				{ width: 200, height: 100 },
				"contain",
			),
		).toEqual({
			x: -15,
			y: 20,
			scale: { x: 2, y: 2 },
		});
	});

	it.each([
		[
			{ x: 0, y: 0, width: 0, height: 0 },
			{ width: 200, height: 100 },
		],
		[
			{ x: 0, y: 0, width: 50, height: 50 },
			{ width: 0, height: 0 },
		],
	])("gives a finite camera for %o in %o", (rect, size) => {
		for (const fit of ["exact", "contain"] as const) {
			const v = viewForAim(rect, size, fit);
			expect([v.x, v.y, v.scale.x, v.scale.y].every(Number.isFinite)).toBe(
				true,
			);
		}
	});
});

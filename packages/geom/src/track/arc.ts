import type { Point } from "../paths/cubicMath";
import { clamp } from "../scalar";
import type { TrackShape, TrackStation } from "./shape";

/** An arc track: degrees clockwise from 12 o'clock on a y-down plane. Equal `start` and `end` is a whole circle. */
export interface ArcTrackSpec {
	center: Point;
	radius: number;
	start: number;
	end: number;
	/** Which way the track runs from `start` to `end`. Default `'cw'`. */
	direction?: "cw" | "ccw";
}

const RAD = Math.PI / 180;
const mod360 = (a: number): number => ((a % 360) + 360) % 360;

/** A track shape that remembers the arc it was built from, so path data can be drawn as arcs. */
export type ArcTrackShape = TrackShape & { readonly arc: ArcTrackSpec };

/** An arc track; its normal points away from the center, whichever way it runs. */
export function arcShape(spec: ArcTrackSpec): ArcTrackShape {
	const { center, radius, start } = spec;
	const sign = spec.direction === "ccw" ? -1 : 1;
	const raw = mod360(sign * (spec.end - start));
	const sweep = raw === 0 ? 360 : raw;
	const length = radius * sweep * RAD;

	const at = (f: number): TrackStation => {
		const t = clamp(f, 0, 1);
		const theta = (start + sign * t * sweep) * RAD;
		const s = Math.sin(theta);
		const c = Math.cos(theta);
		return {
			point: { x: center.x + radius * s, y: center.y - radius * c },
			tangent: { x: sign * c, y: sign * s },
			normal: { x: s, y: -c },
		};
	};

	const shape: TrackShape = {
		kind: "arc",
		length,
		at,
		nearest(p, options) {
			const dx = p.x - center.x;
			const dy = p.y - center.y;
			const angle = dx === 0 && dy === 0 ? 0 : Math.atan2(dx, -dy) / RAD;
			const offset = mod360(sign * (angle - start));
			let f: number;
			if (offset <= sweep) f = offset / sweep;
			else f = 360 - offset < offset - sweep ? 0 : 1;
			const q = at(f).point;
			const dist = Math.hypot(p.x - q.x, p.y - q.y);
			if (!options?.open) return { f, dist };
			const unwrapped = sweep / 2 + mod360(offset - sweep / 2 + 180) - 180;
			return { f: unwrapped / sweep, dist };
		},
	};
	Object.defineProperty(shape, "arc", { value: spec, enumerable: false });
	return shape as ArcTrackShape;
}

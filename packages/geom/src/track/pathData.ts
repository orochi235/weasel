import type { Point } from "../paths/cubicMath";
import type { ArcTrackShape } from "./arc";
import type { TrackShape } from "./shape";

const SAMPLES = 64;

const num = (v: number): string => {
	const r = Math.round(v * 1e4) / 1e4;
	return String(r === 0 ? 0 : r);
};
const pt = (p: Point): string => `${num(p.x)} ${num(p.y)}`;
const isArc = (s: TrackShape): s is ArcTrackShape =>
	s.kind === "arc" && "arc" in s;

/** SVG path data for the stretch `from..to` of a shape: a segment for a line, true arcs for an arc, else a 64-step polyline. */
export function trackShapeD(shape: TrackShape, from = 0, to = 1): string {
	const a = shape.at(from).point;
	const b = shape.at(to).point;
	if (shape.kind === "line") return `M ${pt(a)} L ${pt(b)}`;
	if (isArc(shape)) {
		const { radius, direction } = shape.arc;
		const r = num(radius);
		const turn = (shape.length * Math.abs(to - from)) / radius;
		const sweep = (direction === "ccw") === to < from ? 1 : 0;
		if (turn >= 2 * Math.PI - 1e-9) {
			const m = shape.at((from + to) / 2).point;
			return `M ${pt(a)} A ${r} ${r} 0 0 ${sweep} ${pt(m)} A ${r} ${r} 0 0 ${sweep} ${pt(b)}`;
		}
		return `M ${pt(a)} A ${r} ${r} 0 ${turn > Math.PI ? 1 : 0} ${sweep} ${pt(b)}`;
	}
	let d = `M ${pt(a)}`;
	for (let i = 1; i <= SAMPLES; i++)
		d += ` L ${pt(shape.at(from + ((to - from) * i) / SAMPLES).point)}`;
	return d;
}

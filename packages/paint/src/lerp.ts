/** `a + (b - a) * t`, which can miss `b` by an ulp at `t = 1`, so that end is `b` itself. */
export const lerp = (a: number, b: number, t: number): number => (t === 1 ? b : a + (b - a) * t);

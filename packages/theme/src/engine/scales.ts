export interface ScaleParams {
  readonly base: number;
  readonly step?: number;
  readonly ratio?: number;
  readonly factors?: readonly number[];
}

export function scale(steps: readonly string[], p: ScaleParams): Record<string, string> {
  const rules = [p.step, p.ratio, p.factors].filter((r) => r !== undefined);
  if (rules.length !== 1) {
    throw new Error('A scale takes exactly one of `step`, `ratio` and `factors`');
  }
  if (p.factors && p.factors.length !== steps.length) {
    throw new Error(`A scale needs one factor per step; got ${p.factors.length} for ${steps.length} steps`);
  }
  const out: Record<string, string> = {};
  steps.forEach((name, i) => {
    let v: number;
    if (p.factors !== undefined) v = p.base * p.factors[i];
    else if (p.step !== undefined) v = p.base + p.step * i;
    else v = p.base * p.ratio! ** i;
    out[name] = `${Math.round(v)}px`;
  });
  return out;
}

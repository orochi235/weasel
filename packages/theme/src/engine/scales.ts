export interface ScaleParams {
  readonly base: number;
  readonly step?: number;
  readonly ratio?: number;
}

export function scale(steps: readonly string[], p: ScaleParams): Record<string, string> {
  if ((p.step === undefined) === (p.ratio === undefined)) {
    throw new Error('A scale takes exactly one of `step` and `ratio`');
  }
  const out: Record<string, string> = {};
  steps.forEach((name, i) => {
    const v = p.step !== undefined ? p.base + p.step * i : p.base * p.ratio! ** i;
    out[name] = `${Math.round(v)}px`;
  });
  return out;
}

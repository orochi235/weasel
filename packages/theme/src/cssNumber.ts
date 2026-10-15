const NUMBER = /^(-?(?:\d+\.?\d*|\.\d+))([a-z%]*)$/i;

/** A CSS number and its unit (`''` for none), or `undefined` for text that is anything else: a `calc()`, a `var()`, a list. */
export function readCssNumber(css: string): { value: number; unit: string } | undefined {
  const m = NUMBER.exec(css.trim());
  return m ? { value: Number(m[1]), unit: m[2]! } : undefined;
}

export const IDENT = /^[A-Za-z_]\w*$/;

/** Comments stripped and directives removed. Every conditional branch is kept:
 *  an extra name only looks up a null location, a missing one drops writes. */
export function preprocess(glsl: string): { code: string; defines: Map<string, string[]> } {
  const spliced = glsl.replace(/\\\r?\n/g, '');
  let stripped = '';
  for (let k = 0; k < spliced.length; k++) {
    if (spliced[k] === '/' && spliced[k + 1] === '/') {
      while (k < spliced.length && spliced[k] !== '\n') k++;
      stripped += '\n';
    } else if (spliced[k] === '/' && spliced[k + 1] === '*') {
      const end = spliced.indexOf('*/', k + 2);
      k = end < 0 ? spliced.length : end + 1;
      stripped += ' ';
    } else {
      stripped += spliced[k];
    }
  }
  const defines = new Map<string, string[]>();
  const lines = stripped.split('\n').map((line) => {
    if (!/^\s*#/.test(line)) return line;
    const def = /^\s*#\s*define\s+([A-Za-z_]\w*)(\(?)(.*)$/.exec(line);
    if (def && !def[2]) defines.set(def[1], [...(defines.get(def[1]) ?? []), def[3].trim()]);
    return '';
  });
  return { code: lines.join('\n'), defines };
}

export function tokenize(src: string): string[] {
  return src.match(/[A-Za-z_]\w*|\d[\w.]*|\S/g) ?? [];
}

function intLiteral(tok: string): number | null {
  const m = /^(?:0[xX]([0-9a-fA-F]+)|(0[0-7]*)|([1-9]\d*))[uU]?$/.exec(tok);
  if (!m) return null;
  if (m[1] !== undefined) return parseInt(m[1], 16);
  if (m[2] !== undefined) return parseInt(m[2], 8);
  return parseInt(m[3], 10);
}

/** Integer constant expression over `+ - * / %` and parentheses. */
export function evalInt(toks: readonly string[], lookup: (name: string) => number | null): number | null {
  let p = 0;
  const primary = (): number | null => {
    const t = toks[p++];
    if (t === '(') {
      const v = sum();
      return toks[p++] === ')' ? v : null;
    }
    if (t === '-') {
      const v = primary();
      return v === null ? null : -v;
    }
    if (t === '+') return primary();
    if (t === undefined) return null;
    return intLiteral(t) ?? (IDENT.test(t) ? lookup(t) : null);
  };
  const product = (): number | null => {
    let v = primary();
    while (v !== null && (toks[p] === '*' || toks[p] === '/' || toks[p] === '%')) {
      const op = toks[p++];
      const r = primary();
      if (r === null || (op !== '*' && r === 0)) return null;
      v = op === '*' ? v * r : op === '/' ? Math.trunc(v / r) : v % r;
    }
    return v;
  };
  const sum = (): number | null => {
    let v = product();
    while (v !== null && (toks[p] === '+' || toks[p] === '-')) {
      const op = toks[p++];
      const r = product();
      if (r === null) return null;
      v = op === '+' ? v + r : v - r;
    }
    return v;
  };
  const v = sum();
  return p === toks.length && v !== null && v >= 0 ? v : null;
}

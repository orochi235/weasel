import { MINUS_SIGN, withSpellings } from './number';
import { unitScale, type Unit, type UnitSystem } from './units';

/**
 * Arithmetic over values in different units, as plain data: `50% + 2ft`
 * parses once and resolves against whatever context it is handed, so a stored
 * expression follows a parent that resizes. `value` nodes are the leaves.
 */
export type UnitExpr =
  | { op: 'value'; value: number; unit?: Unit }
  | { op: 'neg'; of: UnitExpr }
  | { op: 'add' | 'sub' | 'mul' | 'div'; left: UnitExpr; right: UnitExpr };

/** What a {@link UnitExpr} resolves against. */
export interface UnitExprContext {
  unitSystem?: UnitSystem;
  /** What `100%` is, in base units. A `%` term throws without it, unless the
   *  unit system carries a `%` unit of its own. */
  percentOf?: number;
}

type Token = { kind: 'value'; value: number; unit?: Unit } | { kind: 'op'; op: string };

const TOKEN = /\s*(?:(\d+(?:\.\d+)?|\.\d+)\s*([^\s\d.+\-−*×/÷()]+)?|([+\-−*×/÷()]))/y;
const OPS: Record<string, string> = { [MINUS_SIGN]: '-', '×': '*', '÷': '/' };

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let at = 0;
  while (text.slice(at).trim() !== '') {
    TOKEN.lastIndex = at;
    const m = TOKEN.exec(text);
    if (!m) throw new Error(`unitExpr: cannot read '${text.slice(at).trim()}' in '${text}'`);
    at = TOKEN.lastIndex;
    if (m[1] === undefined) tokens.push({ kind: 'op', op: OPS[m[3]!] ?? m[3]! });
    else if (m[2] === undefined) tokens.push({ kind: 'value', value: Number(m[1]) });
    else tokens.push({ kind: 'value', value: Number(m[1]), unit: m[2] });
  }
  return tokens;
}

/**
 * Parse arithmetic over unit-tagged numbers: `+ - * /` (also `− × ÷`),
 * parentheses, and adjacent terms read as one compound value (`5ft 3in`),
 * with a leading sign carried across all of them. Throws on text it cannot
 * read. Unit names are not checked here — resolving does that.
 */
export function parseUnitExpr(text: string): UnitExpr {
  const tokens = tokenize(text);
  let i = 0;
  const isOp = (op: string): boolean => {
    const t = tokens[i];
    return t !== undefined && t.kind === 'op' && t.op === op;
  };
  const fail = (): never => {
    throw new Error(`unitExpr: '${text}' is not a complete expression`);
  };

  const sum = (): UnitExpr => {
    let left = product();
    while (isOp('+') || isOp('-')) {
      const op = isOp('+') ? 'add' : 'sub';
      i++;
      left = { op, left, right: product() };
    }
    return left;
  };
  const product = (): UnitExpr => {
    let left = unary();
    while (isOp('*') || isOp('/')) {
      const op = isOp('*') ? 'mul' : 'div';
      i++;
      left = { op, left, right: unary() };
    }
    return left;
  };
  const unary = (): UnitExpr => {
    if (isOp('+')) {
      i++;
      return unary();
    }
    if (!isOp('-')) return primary();
    i++;
    const of = unary();
    // Folded into the literal so an offset unit keeps its meaning: −10degC is 263.15K.
    return of.op === 'value' ? { ...of, value: -of.value } : { op: 'neg', of };
  };
  const primary = (): UnitExpr => {
    if (isOp('(')) {
      i++;
      const inner = sum();
      if (!isOp(')')) fail();
      i++;
      return inner;
    }
    let left = literal();
    while (tokens[i]?.kind === 'value') left = { op: 'add', left, right: literal() };
    return left;
  };
  const literal = (): UnitExpr => {
    const t = tokens[i];
    if (t === undefined || t.kind !== 'value') return fail();
    i++;
    return t.unit === undefined
      ? { op: 'value', value: t.value }
      : { op: 'value', value: t.value, unit: t.unit };
  };

  const expr = sum();
  if (i !== tokens.length) fail();
  return expr;
}

interface Resolved {
  n: number;
  /** A measure, in base units — as against a bare scalar. */
  measure: boolean;
  /** From a unit that puts zero somewhere else, so it is a point and not an amount. */
  offset: boolean;
}

function resolveNode(expr: UnitExpr, ctx: UnitExprContext): Resolved {
  if (expr.op === 'value') return resolveValue(expr.value, expr.unit, ctx);
  if (expr.op === 'neg') {
    const of = amountOf(resolveNode(expr.of, ctx));
    return { ...of, n: -of.n };
  }
  const l = amountOf(resolveNode(expr.left, ctx));
  const r = amountOf(resolveNode(expr.right, ctx));
  switch (expr.op) {
    case 'add':
      return { n: l.n + r.n, measure: l.measure || r.measure, offset: false };
    case 'sub':
      return { n: l.n - r.n, measure: l.measure || r.measure, offset: false };
    case 'mul':
      if (l.measure && r.measure) throw new Error('unitExpr: cannot multiply two measures');
      return { n: l.n * r.n, measure: l.measure || r.measure, offset: false };
    case 'div':
      if (r.measure && !l.measure) throw new Error('unitExpr: cannot divide by a measure');
      return { n: l.n / r.n, measure: l.measure && !r.measure, offset: false };
  }
}

function amountOf(r: Resolved): Resolved {
  if (r.offset) {
    throw new Error('unitExpr: a unit with an offset names a point, and has no place in arithmetic');
  }
  return r;
}

function resolveValue(value: number, unit: Unit | undefined, ctx: UnitExprContext): Resolved {
  if (unit === undefined) return { n: value, measure: false, offset: false };
  const units = ctx.unitSystem ? withSpellings(ctx.unitSystem.units) : undefined;
  if (unit === '%' && units?.['%'] === undefined) {
    if (ctx.percentOf === undefined) {
      throw new Error(`unitExpr: ${value}% needs a percentOf to resolve against`);
    }
    return { n: (value / 100) * ctx.percentOf, measure: true, offset: false };
  }
  if (!ctx.unitSystem || !units) throw new Error(`unitExpr: ${value}${unit} requires a UnitSystem`);
  let scale: ReturnType<typeof unitScale>;
  try {
    scale = unitScale({ base: ctx.unitSystem.base, units }, unit);
  } catch (e) {
    throw new Error(`unitExpr: ${e instanceof Error ? e.message : String(e)}`);
  }
  return { n: value * scale.factor + scale.offset, measure: true, offset: scale.offset !== 0 };
}

/**
 * An expression's value in base units. A bare number beside `+` or `-` is
 * read as base units, as it is everywhere a `UnitValue` goes, and beside `*`
 * or `/` as a scalar. A measure over a measure is a scalar; a product of two
 * measures, or a scalar over a measure, throws.
 */
export function resolveUnitExpr(expr: UnitExpr | string, ctx: UnitExprContext = {}): number {
  return resolveNode(typeof expr === 'string' ? parseUnitExpr(expr) : expr, ctx).n;
}

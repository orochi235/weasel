import { evalInt, IDENT, preprocess, tokenize } from './glslSource';

/** Qualifiers GLSL allows between `uniform` and the type name, and before a
 *  struct member's type. */
const QUALIFIERS = new Set([
  'lowp', 'mediump', 'highp', 'precise', 'invariant',
  'centroid', 'flat', 'smooth', 'noperspective',
]);

const MAX_DEPTH = 16;

interface Member {
  readonly type: string | readonly Member[];
  readonly name: string;
  /** `null` for a non-array. */
  readonly size: number | null;
}

/**
 * The names a program's uniforms answer to in `getUniformLocation`: array
 * uniforms per slot (`u_ripples[0]`), struct uniforms per leaf
 * (`u_lights[1].pos`), nested structs and array members included.
 *
 * A declaration scanner over a token stream, not a GLSL parser. Comments are
 * stripped; interface blocks are skipped, since a UBO's members are bound
 * through a buffer rather than a location. Array sizes resolve through integer
 * literals, `#define`s and top-level `const int`s, with `+ - * / %` between
 * them; a size it cannot resolve drops that declarator, and a later write to
 * it warns.
 */
export function extractUniformNames(glsl: string): string[] {
  return [...scanUniforms(glsl).names];
}

/** An array uniform of a basic type: its element type as spelled (`vec3`,
 *  `int`, `mat4`) and its declared length. */
export interface UniformArrayDecl {
  readonly type: string;
  readonly size: number;
}

/**
 * Every array of a basic type a program declares, keyed by the name its slots
 * hang off (`u_ripples` for `u_ripples[0]`). An array inside a struct is keyed
 * by its full path (`u_lights[1].weights`); an array of structs is not an
 * entry, since it has no single element type.
 */
export function extractUniformArrays(glsl: string): Map<string, UniformArrayDecl> {
  return scanUniforms(glsl).arrays;
}

/** The array size spelled by tokens `[from, to)`, or null if unresolvable. */
type SizeOf = (from: number, to: number) => number | null;

/** What a scan produces: every location name, and every basic-type array. */
interface UniformScan {
  readonly names: Set<string>;
  readonly arrays: Map<string, UniformArrayDecl>;
}

function scanUniforms(glsl: string): UniformScan {
  const { code, defines } = preprocess(glsl);
  const toks = tokenize(code);
  const consts = new Map<string, number>();
  const structs = new Map<string, Member[]>();
  const scan: UniformScan = { names: new Set(), arrays: new Map() };

  const resolveName = (name: string, depth: number): number | null => {
    if (depth > MAX_DEPTH) return null;
    let best: number | null = null;
    for (const body of defines.get(name) ?? []) {
      const v = evalInt(tokenize(body), (n) => resolveName(n, depth + 1));
      if (v !== null && (best === null || v > best)) best = v;
    }
    return best ?? consts.get(name) ?? null;
  };
  const sizeOf: SizeOf = (from, to) => evalInt(toks.slice(from, to), (n) => resolveName(n, 0));

  let depth = 0;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t === '{') depth++;
    else if (t === '}') depth--;
    else if (t === 'struct') i = structSpecifier(toks, i, sizeOf, structs)[1] - 1;
    else if (depth === 0 && t === 'const') recordConstInt(toks, i, sizeOf, consts);
    else if (depth === 0 && t === 'uniform') i = uniformDeclaration(toks, i, sizeOf, structs, scan);
  }
  return scan;
}

/** Records a top-level `const int N = expr;` at `i`, keeping the largest value
 *  a name takes across preprocessor branches. */
function recordConstInt(toks: readonly string[], i: number, sizeOf: SizeOf, consts: Map<string, number>): void {
  let j = i + 1;
  while (QUALIFIERS.has(toks[j])) j++;
  if ((toks[j] !== 'int' && toks[j] !== 'uint') || !IDENT.test(toks[j + 1] ?? '') || toks[j + 2] !== '=') return;
  let end = j + 3;
  while (end < toks.length && toks[end] !== ';') end++;
  const v = sizeOf(j + 3, end);
  const prior = consts.get(toks[j + 1]);
  if (v !== null && (prior === undefined || v > prior)) consts.set(toks[j + 1], v);
}

/** Adds the names the `uniform` declaration at `i` answers to into `scan`.
 *  Returns the index of its terminator. */
function uniformDeclaration(
  toks: readonly string[],
  i: number,
  sizeOf: SizeOf,
  structs: Map<string, Member[]>,
  scan: UniformScan,
): number {
  let j = i + 1;
  while (QUALIFIERS.has(toks[j])) j++;
  let type: string | Member[];
  if (toks[j] === 'struct') {
    [type, j] = structSpecifier(toks, j, sizeOf, structs);
  } else if (toks[j + 1] === '{') {
    // An interface block: skip it and its instance name.
    j = closer(toks, j + 1) + 1;
    while (j < toks.length && toks[j] !== ';') j++;
    return j;
  } else {
    type = toks[j++];
  }
  const [typeSize, afterType] = arraySuffix(toks, j, sizeOf);
  const [decls, term] = declarators(toks, afterType, typeSize, sizeOf);
  for (const d of decls) if (d.size !== null) expand(d.name, type, d.size ?? null, 0, structs, scan);
  return term;
}

/** Index of the token closing the bracket opened at `open`. */
function closer(toks: readonly string[], open: number): number {
  let depth = 0;
  for (let k = open; k < toks.length; k++) {
    if (toks[k] === '(' || toks[k] === '[' || toks[k] === '{') depth++;
    else if (toks[k] === ')' || toks[k] === ']' || toks[k] === '}') {
      if (--depth === 0) return k;
    }
  }
  return toks.length;
}

/** Parses `[size]` at `j` if present: the size (undefined if absent, null
 *  if unresolvable) and where scanning resumes. */
function arraySuffix(toks: readonly string[], j: number, sizeOf: SizeOf): [number | null | undefined, number] {
  if (toks[j] !== '[') return [undefined, j];
  const end = closer(toks, j);
  return [sizeOf(j + 1, end), end + 1];
}

interface Declarator {
  readonly name: string;
  readonly size: number | null | undefined;
}

/** Declarators `a, b[2], c` up to the terminating `;` (or `}`), after the
 *  type at `j`. Returns them and the index of the terminator. */
function declarators(
  toks: readonly string[],
  j: number,
  typeSize: number | null | undefined,
  sizeOf: SizeOf,
): [Declarator[], number] {
  const found: Declarator[] = [];
  while (j < toks.length && toks[j] !== ';' && toks[j] !== '}') {
    const name = toks[j];
    const [size, next] = arraySuffix(toks, j + 1, sizeOf);
    j = next;
    if (IDENT.test(name)) found.push({ name, size: size === undefined ? typeSize : size });
    // Skip an initializer, or anything else, to the next declarator.
    while (j < toks.length && toks[j] !== ',' && toks[j] !== ';' && toks[j] !== '}') {
      j = toks[j] === '(' || toks[j] === '[' || toks[j] === '{' ? closer(toks, j) + 1 : j + 1;
    }
    if (toks[j] === ',') j++;
  }
  return [found, j];
}

/** `struct Name? { members }` at `i`; records a named struct in `structs`. */
function structSpecifier(
  toks: readonly string[],
  i: number,
  sizeOf: SizeOf,
  structs: Map<string, Member[]>,
): [Member[], number] {
  let j = i + 1;
  const name = toks[j] !== '{' ? toks[j++] : undefined;
  const members: Member[] = [];
  if (toks[j] !== '{') return [members, j];
  const end = closer(toks, j);
  j++;
  while (j < end) {
    while (QUALIFIERS.has(toks[j])) j++;
    let type: string | Member[];
    if (toks[j] === 'struct') [type, j] = structSpecifier(toks, j, sizeOf, structs);
    else type = toks[j++];
    const [typeSize, afterType] = arraySuffix(toks, j, sizeOf);
    const [decls, term] = declarators(toks, afterType, typeSize, sizeOf);
    for (const d of decls) if (d.size !== null) members.push({ type, name: d.name, size: d.size ?? null });
    j = term + 1;
  }
  if (name) {
    // A struct redefined in another preprocessor branch keeps both members lists.
    const prior = structs.get(name) ?? [];
    for (const m of members) if (!prior.some((p) => p.name === m.name)) prior.push(m);
    structs.set(name, prior);
  }
  return [members, end + 1];
}

/** Adds the location names a uniform of `type` declared as `name` answers to,
 *  one per array slot and struct leaf, into `scan`. */
function expand(
  name: string,
  type: string | readonly Member[],
  size: number | null,
  depth: number,
  structs: ReadonlyMap<string, readonly Member[]>,
  scan: UniformScan,
): void {
  if (depth > MAX_DEPTH) return;
  if (size !== null) {
    if (typeof type === 'string' && !structs.has(type)) {
      const prior = scan.arrays.get(name);
      if (!prior || size > prior.size) scan.arrays.set(name, { type, size });
    }
    for (let k = 0; k < size; k++) expand(`${name}[${k}]`, type, null, depth + 1, structs, scan);
    return;
  }
  const members = typeof type === 'string' ? structs.get(type) : type;
  if (!members) {
    scan.names.add(name);
    return;
  }
  for (const m of members) expand(`${name}.${m.name}`, m.type, m.size, depth + 1, structs, scan);
}

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

function scanUniforms(glsl: string): { names: Set<string>; arrays: Map<string, UniformArrayDecl> } {
  const { code, defines } = preprocess(glsl);
  const toks = tokenize(code);
  const consts = new Map<string, number>();
  const structs = new Map<string, Member[]>();
  const out = new Set<string>();
  const arrays = new Map<string, UniformArrayDecl>();

  const resolveName = (name: string, depth: number): number | null => {
    if (depth > MAX_DEPTH) return null;
    let best: number | null = null;
    for (const body of defines.get(name) ?? []) {
      const v = evalInt(tokenize(body), (n) => resolveName(n, depth + 1));
      if (v !== null && (best === null || v > best)) best = v;
    }
    return best ?? consts.get(name) ?? null;
  };
  const evalSize = (from: number, to: number) => evalInt(toks.slice(from, to), (n) => resolveName(n, 0));

  /** Index of the token closing the bracket opened at `open`. */
  const closer = (open: number): number => {
    let depth = 0;
    for (let k = open; k < toks.length; k++) {
      if (toks[k] === '(' || toks[k] === '[' || toks[k] === '{') depth++;
      else if (toks[k] === ')' || toks[k] === ']' || toks[k] === '}') {
        if (--depth === 0) return k;
      }
    }
    return toks.length;
  };

  /** Parses `[size]` at `j` if present: the size (undefined if absent, null
   *  if unresolvable) and where scanning resumes. */
  const arraySuffix = (j: number): [number | null | undefined, number] => {
    if (toks[j] !== '[') return [undefined, j];
    const end = closer(j);
    return [evalSize(j + 1, end), end + 1];
  };

  /** Declarators `a, b[2], c` up to the terminating `;` (or `}`), after the
   *  type at `j`. Returns them and the index of the terminator. */
  const declarators = (
    j: number,
    typeSize: number | null | undefined,
  ): [{ name: string; size: number | null | undefined }[], number] => {
    const found: { name: string; size: number | null | undefined }[] = [];
    while (j < toks.length && toks[j] !== ';' && toks[j] !== '}') {
      const name = toks[j];
      const [size, next] = arraySuffix(j + 1);
      j = next;
      if (IDENT.test(name)) found.push({ name, size: size === undefined ? typeSize : size });
      // Skip an initializer, or anything else, to the next declarator.
      while (j < toks.length && toks[j] !== ',' && toks[j] !== ';' && toks[j] !== '}') {
        j = toks[j] === '(' || toks[j] === '[' || toks[j] === '{' ? closer(j) + 1 : j + 1;
      }
      if (toks[j] === ',') j++;
    }
    return [found, j];
  };

  /** `struct Name? { members }` at `i`; records a named struct. */
  const structSpecifier = (i: number): [Member[], number] => {
    let j = i + 1;
    const name = toks[j] !== '{' ? toks[j++] : undefined;
    const members: Member[] = [];
    if (toks[j] !== '{') return [members, j];
    const end = closer(j);
    j++;
    while (j < end) {
      while (QUALIFIERS.has(toks[j])) j++;
      let type: string | Member[];
      if (toks[j] === 'struct') [type, j] = structSpecifier(j);
      else type = toks[j++];
      const [typeSize, afterType] = arraySuffix(j);
      const [decls, term] = declarators(afterType, typeSize);
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
  };

  const expand = (name: string, type: string | readonly Member[], size: number | null, depth: number): void => {
    if (depth > MAX_DEPTH) return;
    if (size !== null) {
      if (typeof type === 'string' && !structs.has(type)) {
        const prior = arrays.get(name);
        if (!prior || size > prior.size) arrays.set(name, { type, size });
      }
      for (let k = 0; k < size; k++) expand(`${name}[${k}]`, type, null, depth + 1);
      return;
    }
    const members = typeof type === 'string' ? structs.get(type) : type;
    if (!members) {
      out.add(name);
      return;
    }
    for (const m of members) expand(`${name}.${m.name}`, m.type, m.size, depth + 1);
  };

  let depth = 0;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t === '{') depth++;
    else if (t === '}') depth--;
    else if (t === 'struct') i = structSpecifier(i)[1] - 1;
    else if (depth === 0 && t === 'const') {
      let j = i + 1;
      while (QUALIFIERS.has(toks[j])) j++;
      if ((toks[j] === 'int' || toks[j] === 'uint') && IDENT.test(toks[j + 1] ?? '') && toks[j + 2] === '=') {
        let end = j + 3;
        while (end < toks.length && toks[end] !== ';') end++;
        const v = evalSize(j + 3, end);
        const prior = consts.get(toks[j + 1]);
        if (v !== null && (prior === undefined || v > prior)) consts.set(toks[j + 1], v);
      }
    } else if (depth === 0 && t === 'uniform') {
      let j = i + 1;
      while (QUALIFIERS.has(toks[j])) j++;
      let type: string | Member[];
      if (toks[j] === 'struct') {
        [type, j] = structSpecifier(j);
      } else if (toks[j + 1] === '{') {
        // An interface block: skip it and its instance name.
        j = closer(j + 1) + 1;
        while (j < toks.length && toks[j] !== ';') j++;
        i = j;
        continue;
      } else {
        type = toks[j++];
      }
      const [typeSize, afterType] = arraySuffix(j);
      const [decls, term] = declarators(afterType, typeSize);
      for (const d of decls) if (d.size !== null) expand(d.name, type, d.size ?? null, 0);
      i = term;
    }
  }
  return { names: out, arrays };
}

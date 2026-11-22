/** What a WGSL program declares at module scope that the kit binds by name: its
 *  structs, laid out under WGSL's uniform address-space rules, and its group bindings. */

import { getOwn } from '@weasel-js/registry';
import { attributeInt, moduleConsts, stripWgslComments, WGSL_INT, wgslInt } from './wgslLexical';

export type WgslScalar = 'f32' | 'i32' | 'u32';

export type WgslType =
  | { kind: 'scalar'; scalar: WgslScalar }
  | { kind: 'vector'; scalar: WgslScalar; n: 2 | 3 | 4 }
  | { kind: 'matrix'; cols: 2 | 3 | 4; rows: 2 | 3 | 4 }
  | { kind: 'array'; element: WgslType; count: number; stride: number }
  | { kind: 'struct'; name: string };

export interface WgslMember {
  name: string;
  type: WgslType;
  offset: number;
  size: number;
}

export interface WgslStruct {
  name: string;
  members: WgslMember[];
  align: number;
  size: number;
}

export type WgslBindingKind = 'uniform' | 'texture' | 'sampler' | 'storage';

export interface WgslBinding {
  group: number;
  binding: number;
  name: string;
  kind: WgslBindingKind;
  /** The struct a uniform binding holds, a uniform of plain type as a one-member struct named for it in
   *  `structs`; unset for a texture, a sampler, or a storage binding. */
  struct?: string;
}

export interface WgslReflection {
  structs: Map<string, WgslStruct>;
  bindings: WgslBinding[];
}

const SCALARS: Record<string, WgslScalar> = { f32: 'f32', i32: 'i32', u32: 'u32' };
const SUFFIX: Readonly<Record<'f' | 'i' | 'u', WgslScalar>> = { f: 'f32', i: 'i32', u: 'u32' };

/** Split `a, b<c, d>, e` at depth-0 commas. */
function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '<' || c === '(') depth++;
    else if (c === '>' || c === ')') depth--;
    else if (c === ',' && depth === 0) {
      out.push(s.slice(start, i));
      start = i + 1;
    }
  }
  out.push(s.slice(start));
  return out.map((p) => p.trim()).filter((p) => p.length > 0);
}

function roundUp(align: number, n: number): number {
  return Math.ceil(n / align) * align;
}

interface Layout {
  align: number;
  size: number;
}

function layoutOf(t: WgslType, structs: Map<string, WgslStruct>): Layout {
  switch (t.kind) {
    case 'scalar':
      return { align: 4, size: 4 };
    case 'vector':
      return { align: t.n === 2 ? 8 : 16, size: 4 * t.n };
    case 'matrix': {
      const col = layoutOf({ kind: 'vector', scalar: 'f32', n: t.rows }, structs);
      return { align: col.align, size: t.cols * roundUp(col.align, col.size) };
    }
    case 'array':
      return { align: layoutOf(t.element, structs).align, size: t.count * t.stride };
    case 'struct': {
      const s = structs.get(t.name);
      if (!s) throw new Error(`WGSL: struct ${t.name} is used before it is declared`);
      return { align: s.align, size: s.size };
    }
  }
}

/** Structs the module declares that no uniform can hold — a `bool` member, a runtime-sized array — by the
 *  error laying one out raised. A helper or IO struct may be one; only a uniform naming it is refused. */
type Unlaid = ReadonlyMap<string, Error>;

function parseType(
  src: string, structs: Map<string, WgslStruct>, consts: Map<string, number>, unlaid: Unlaid,
): WgslType {
  const s = src.replace(/\s+/g, '');
  const scalar = getOwn(SCALARS, s);
  if (scalar) return { kind: 'scalar', scalar };
  let m = /^vec([234])([fiu])$/.exec(s);
  if (m) return { kind: 'vector', scalar: SUFFIX[m[2] as 'f' | 'i' | 'u'], n: Number(m[1]) as 2 | 3 | 4 };
  m = /^vec([234])<(f32|i32|u32)>$/.exec(s);
  if (m) return { kind: 'vector', scalar: m[2] as WgslScalar, n: Number(m[1]) as 2 | 3 | 4 };
  m = /^mat([234])x([234])(?:f|<f32>)$/.exec(s);
  if (m) return { kind: 'matrix', cols: Number(m[1]) as 2 | 3 | 4, rows: Number(m[2]) as 2 | 3 | 4 };
  m = /^array<(.+)>$/.exec(s);
  if (m) {
    const parts = splitTop(m[1]);
    if (parts.length !== 2) throw new Error(`WGSL: a uniform array needs a fixed size: ${src}`);
    const element = parseType(parts[0], structs, consts, unlaid);
    const count = wgslInt(parts[1]) ?? consts.get(parts[1]);
    if (count === undefined) throw new Error(`WGSL: unknown array size ${parts[1]}`);
    const el = layoutOf(element, structs);
    return { kind: 'array', element, count, stride: roundUp(el.align, el.size) };
  }
  if (structs.has(s)) return { kind: 'struct', name: s };
  throw unlaid.get(s) ?? new Error(`WGSL: unsupported type ${src.trim()}`);
}

function parseStruct(
  name: string, body: string, structs: Map<string, WgslStruct>, consts: Map<string, number>, unlaid: Unlaid,
): WgslStruct {
  const members: WgslMember[] = [];
  let offset = 0;
  let align = 1;
  for (const raw of splitTop(body)) {
    let decl = raw;
    let alignAttr: number | undefined;
    let sizeAttr: number | undefined;
    for (;;) {
      const a = /^@(\w+)(?:\s*\(([^)]*)\))?\s*/.exec(decl);
      if (!a) break;
      if (a[1] === 'align') alignAttr = attributeInt(a[0], a[2], consts);
      if (a[1] === 'size') sizeAttr = attributeInt(a[0], a[2], consts);
      decl = decl.slice(a[0].length);
    }
    const colon = decl.indexOf(':');
    if (colon < 0) continue;
    const memberName = decl.slice(0, colon).trim();
    const type = parseType(decl.slice(colon + 1), structs, consts, unlaid);
    const lay = layoutOf(type, structs);
    const memberAlign = alignAttr ?? lay.align;
    const size = sizeAttr ?? lay.size;
    offset = roundUp(memberAlign, offset);
    members.push({ name: memberName, type, offset, size });
    offset += size;
    align = Math.max(align, memberAlign);
  }
  return { name, members, align, size: roundUp(align, offset) };
}

/** What the browser compiling a module allows. */
export interface WgslTarget {
  /** `navigator.gpu.wgslLanguageFeatures.has('uniform_buffer_standard_layout')`: a uniform buffer is laid out
   *  as a storage one is. Without it the layout is the same, but a uniform struct must already sit on 16-byte
   *  boundaries where WGSL asks, or the module does not compile. */
  standardLayout: boolean;
}

/** Throw, naming the member, where a struct bound as a uniform breaks the constraints a uniform buffer keeps
 *  without `uniform_buffer_standard_layout`: a struct or array member on a 16-byte boundary, the member after
 *  a struct 16-byte rounded past it, and an array's stride a multiple of 16. */
function checkUniformLayout(struct: WgslStruct, structs: Map<string, WgslStruct>, path: string): void {
  const needs = (what: string) => new Error(
    `WGSL: uniform member ${what}; this browser lacks uniform_buffer_standard_layout, so pad it with @align/@size or a slot struct`,
  );
  struct.members.forEach((m, i) => {
    const name = `${path}.${m.name}`;
    let t = m.type;
    if (t.kind === 'struct' || t.kind === 'array') {
      if (m.offset % 16 !== 0) throw needs(`${name} is at offset ${m.offset}, not a multiple of 16`);
    }
    if (t.kind === 'struct') {
      const next = struct.members[i + 1];
      const inner = structs.get(t.name)!;
      if (next && next.offset < m.offset + roundUp(16, inner.size)) throw needs(`after struct ${name} starts inside its 16-byte rounding`);
    }
    while (t.kind === 'array') {
      if (t.stride % 16 !== 0) throw needs(`${name} has an array stride of ${t.stride}, not a multiple of 16`);
      t = t.element;
    }
    if (t.kind === 'struct') checkUniformLayout(structs.get(t.name)!, structs, name);
  });
}

/** The struct key of a uniform of plain type: no WGSL identifier, so no declared struct shares it. */
function plainUniform(name: string): string {
  return `var<uniform> ${name}`;
}

/** A uniform of plain type as the one-member struct it lays out as, its member named for the variable. */
function plainStruct(
  name: string, type: string, structs: Map<string, WgslStruct>, consts: Map<string, number>, unlaid: Unlaid,
): WgslStruct {
  try {
    return parseStruct(plainUniform(name), `${name}: ${type}`, structs, consts, unlaid);
  } catch (e) {
    throw new Error(`WGSL: uniform ${name}: ${(e as Error).message.replace(/^WGSL: /, '')}`);
  }
}

/** Reflect the structs and `@group`/`@binding` variables a WGSL module declares. Every struct is laid out by
 *  WGSL's one set of rules; `target` says whether a uniform struct must also keep the stricter uniform ones. */
export function reflectWgsl(source: string, target: WgslTarget): WgslReflection {
  const src = stripWgslComments(source);
  const structs = new Map<string, WgslStruct>();
  const consts = moduleConsts(src);
  const unlaid = new Map<string, Error>();
  const bindings: WgslBinding[] = [];
  const token = new RegExp(String.raw`\bconst\s+(\w+)\s*(?::\s*\w+\s*)?=\s*(${WGSL_INT})\s*;|\bstruct\s+(\w+)\s*\{([^}]*)\}|((?:@\w+(?:\s*\([^)]*\))?\s*)+)var(?:<([^>]*)>)?\s+(\w+)\s*:\s*([^;]+);`, 'g');
  // Module-scope declarations may come in any order: consts first, then structs until none is left that the
  // ones laid out so far can lay out, then the variables.
  const matches = [...src.matchAll(token)];
  let pending = matches.filter((m) => m[3]);
  for (let laid = true; laid && pending.length > 0;) {
    laid = false;
    pending = pending.filter((m) => {
      try {
        structs.set(m[3], parseStruct(m[3], m[4], structs, consts, unlaid));
        unlaid.delete(m[3]);
        laid = true;
        return false;
      } catch (e) {
        unlaid.set(m[3], e as Error);
        return true;
      }
    });
  }
  // A struct that failed before what it holds did keeps that member's own error, however deep it sits.
  for (let i = 1; i < pending.length; i++) {
    for (const m of pending) {
      try {
        parseStruct(m[3], m[4], structs, consts, unlaid);
      } catch (e) {
        unlaid.set(m[3], e as Error);
      }
    }
  }
  for (const m of matches) {
    if (m[1] || m[3]) continue;
    const attrs = m[5];
    const group = /@group\s*\(([^)]*)\)/.exec(attrs);
    const binding = /@binding\s*\(([^)]*)\)/.exec(attrs);
    if (!group && !binding) continue;
    if (!group || !binding) throw new Error(`WGSL: ${m[7]} needs both @group and @binding`);
    const space = (m[6] ?? '').split(',')[0].trim();
    const type = m[8].trim();
    if (space === 'uniform' && unlaid.has(type)) throw unlaid.get(type)!;
    if (space === 'uniform' && !structs.has(type)) structs.set(plainUniform(m[7]), plainStruct(m[7], type, structs, consts, unlaid));
    const kind: WgslBindingKind = space === 'uniform' ? 'uniform'
      : space === 'storage' || /^texture_storage_/.test(type) ? 'storage'
      : /^sampler/.test(type) ? 'sampler'
      : 'texture';
    if ((kind === 'texture' && !/^texture_2d\s*<\s*f32\s*>$/.test(type)) || (kind === 'sampler' && type !== 'sampler')) {
      throw new Error(`WGSL: ${m[7]} is a ${type}, which the kit does not bind; it binds texture_2d<f32> and sampler`);
    }
    bindings.push({
      group: attributeInt(group[0], group[1], consts), binding: attributeInt(binding[0], binding[1], consts), name: m[7], kind,
      ...(kind === 'uniform' ? { struct: structs.has(type) ? type : plainUniform(m[7]) } : {}),
    });
  }
  if (!target.standardLayout) {
    for (const b of bindings) if (b.struct) checkUniformLayout(structs.get(b.struct)!, structs, b.name);
  }
  return { structs, bindings };
}

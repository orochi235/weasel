/** What a WGSL program declares at module scope that the kit binds by name: its
 *  structs, laid out under WGSL's uniform address-space rules, and its group bindings. */

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
  /** The struct a uniform binding holds; unset for a texture, a sampler, or
   *  a uniform of a plain type. */
  struct?: string;
}

export interface WgslReflection {
  structs: Map<string, WgslStruct>;
  bindings: WgslBinding[];
}

const SCALARS: Record<string, WgslScalar> = { f32: 'f32', i32: 'i32', u32: 'u32' };
const SUFFIX: Record<string, WgslScalar> = { f: 'f32', i: 'i32', u: 'u32' };

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

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

function parseType(src: string, structs: Map<string, WgslStruct>, consts: Map<string, number>): WgslType {
  const s = src.replace(/\s+/g, '');
  if (SCALARS[s]) return { kind: 'scalar', scalar: SCALARS[s] };
  let m = /^vec([234])([fiu])$/.exec(s);
  if (m) return { kind: 'vector', scalar: SUFFIX[m[2]], n: Number(m[1]) as 2 | 3 | 4 };
  m = /^vec([234])<(f32|i32|u32)>$/.exec(s);
  if (m) return { kind: 'vector', scalar: SCALARS[m[2]], n: Number(m[1]) as 2 | 3 | 4 };
  m = /^mat([234])x([234])(?:f|<f32>)$/.exec(s);
  if (m) return { kind: 'matrix', cols: Number(m[1]) as 2 | 3 | 4, rows: Number(m[2]) as 2 | 3 | 4 };
  m = /^array<(.+)>$/.exec(s);
  if (m) {
    const parts = splitTop(m[1]);
    if (parts.length !== 2) throw new Error(`WGSL: a uniform array needs a fixed size: ${src}`);
    const element = parseType(parts[0], structs, consts);
    const count = /^\d+u?$/.test(parts[1]) ? parseInt(parts[1], 10) : consts.get(parts[1]);
    if (count === undefined) throw new Error(`WGSL: unknown array size ${parts[1]}`);
    const el = layoutOf(element, structs);
    return { kind: 'array', element, count, stride: roundUp(el.align, el.size) };
  }
  if (structs.has(s)) return { kind: 'struct', name: s };
  throw new Error(`WGSL: unsupported type ${src}`);
}

function parseStruct(name: string, body: string, structs: Map<string, WgslStruct>, consts: Map<string, number>): WgslStruct {
  const members: WgslMember[] = [];
  let offset = 0;
  let align = 1;
  for (const raw of splitTop(body)) {
    let decl = raw;
    let alignAttr: number | undefined;
    let sizeAttr: number | undefined;
    for (;;) {
      const a = /^@(\w+)(?:\(([^)]*)\))?\s*/.exec(decl);
      if (!a) break;
      if (a[1] === 'align') alignAttr = Number(a[2]);
      if (a[1] === 'size') sizeAttr = Number(a[2]);
      decl = decl.slice(a[0].length);
    }
    const colon = decl.indexOf(':');
    if (colon < 0) continue;
    const memberName = decl.slice(0, colon).trim();
    const type = parseType(decl.slice(colon + 1), structs, consts);
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

/** Reflect the structs and `@group`/`@binding` variables a WGSL module declares. */
export function reflectWgsl(source: string): WgslReflection {
  const src = stripComments(source);
  const structs = new Map<string, WgslStruct>();
  const consts = new Map<string, number>();
  const bindings: WgslBinding[] = [];
  const token = /\bconst\s+(\w+)\s*(?::\s*\w+\s*)?=\s*(\d+)u?\s*;|\bstruct\s+(\w+)\s*\{([^}]*)\}|((?:@\w+(?:\([^)]*\))?\s*)+)var(?:<([^>]*)>)?\s+(\w+)\s*:\s*([^;]+);/g;
  for (let m = token.exec(src); m; m = token.exec(src)) {
    if (m[1]) {
      consts.set(m[1], parseInt(m[2], 10));
    } else if (m[3]) {
      structs.set(m[3], parseStruct(m[3], m[4], structs, consts));
    } else {
      const attrs = m[5];
      const group = /@group\((\d+)\)/.exec(attrs);
      const binding = /@binding\((\d+)\)/.exec(attrs);
      if (!group || !binding) continue;
      const space = (m[6] ?? '').split(',')[0].trim();
      const type = m[8].trim();
      const kind: WgslBindingKind = space === 'uniform' ? 'uniform'
        : space === 'storage' ? 'storage'
        : /^sampler/.test(type) ? 'sampler'
        : 'texture';
      bindings.push({
        group: Number(group[1]), binding: Number(binding[1]), name: m[7], kind,
        ...(kind === 'uniform' && structs.has(type) ? { struct: type } : {}),
      });
    }
  }
  return { structs, bindings };
}

import type { WgslMember, WgslReflection, WgslScalar, WgslStruct, WgslType } from './wgslReflect';

/** A value set by uniform name, in the shapes GLSL's `uniform*` calls take: a
 *  number, or a flat run of numbers, matrices column-major and unpadded. */
export type UniformValue = number | ArrayLike<number>;

/** One `var<uniform>` struct's bytes, written by member name. */
export interface UniformBlock {
  readonly bytes: ArrayBuffer;
  readonly size: number;
  /** Write a member, or one slot of an array member (`u_alpha[3]`). Returns
   *  false for a name the struct does not declare, which GL would ignore too. */
  set(name: string, value: UniformValue): boolean;
  has(name: string): boolean;
}

interface Slot {
  offset: number;
  type: WgslType;
}

/** How many numbers one element of `t` takes from a flat, unpadded run. */
function flatCount(t: WgslType, structs: Map<string, WgslStruct>): number {
  switch (t.kind) {
    case 'scalar': return 1;
    case 'vector': return t.n;
    case 'matrix': return t.cols * t.rows;
    case 'array': return t.count * flatCount(t.element, structs);
    case 'struct': {
      const s = structs.get(t.name);
      return s ? s.members.reduce((n, m) => n + flatCount(m.type, structs), 0) : 0;
    }
  }
}

function writeScalar(view: DataView, offset: number, scalar: WgslScalar, v: number): void {
  if (scalar === 'f32') view.setFloat32(offset, v, true);
  else if (scalar === 'i32') view.setInt32(offset, v, true);
  else view.setUint32(offset, v >>> 0, true);
}

/** Write `src[from…]` into `t` at `offset`; returns how many numbers it consumed. */
function write(view: DataView, offset: number, t: WgslType, src: ArrayLike<number>, from: number,
  structs: Map<string, WgslStruct>): number {
  switch (t.kind) {
    case 'scalar':
      if (from < src.length) writeScalar(view, offset, t.scalar, src[from]);
      return 1;
    case 'vector':
      for (let i = 0; i < t.n && from + i < src.length; i++) writeScalar(view, offset + 4 * i, t.scalar, src[from + i]);
      return t.n;
    case 'matrix': {
      const colStride = t.rows === 2 ? 8 : 16;
      for (let c = 0; c < t.cols; c++) {
        for (let r = 0; r < t.rows; r++) {
          const i = from + c * t.rows + r;
          if (i < src.length) view.setFloat32(offset + c * colStride + 4 * r, src[i], true);
        }
      }
      return t.cols * t.rows;
    }
    case 'array': {
      let used = 0;
      for (let e = 0; e < t.count && from + used < src.length; e++) {
        used += write(view, offset + e * t.stride, t.element, src, from + used, structs);
      }
      return t.count * flatCount(t.element, structs);
    }
    case 'struct': {
      const s = structs.get(t.name);
      let used = 0;
      for (const m of s?.members ?? []) used += write(view, offset + m.offset, m.type, src, from + used, structs);
      return used;
    }
  }
}

/** Every name a member answers to: itself, and each slot of an array. */
function slotsOf(member: WgslMember): Array<[string, Slot]> {
  const out: Array<[string, Slot]> = [[member.name, { offset: member.offset, type: member.type }]];
  const t = member.type;
  if (t.kind === 'array') {
    for (let i = 0; i < t.count; i++) out.push([`${member.name}[${i}]`, { offset: member.offset + i * t.stride, type: t.element }]);
  }
  return out;
}

/** A block for the struct `structName` names in `reflection`. */
export function createUniformBlock(reflection: WgslReflection, structName: string): UniformBlock {
  const struct = reflection.structs.get(structName);
  if (!struct) throw new Error(`WGSL: no struct ${structName}`);
  const size = Math.max(16, struct.size);
  const bytes = new ArrayBuffer(size);
  const view = new DataView(bytes);
  const slots = new Map<string, Slot>();
  for (const m of struct.members) for (const [name, slot] of slotsOf(m)) slots.set(name, slot);
  const one = [0];
  return {
    bytes,
    size,
    has: (name) => slots.has(name),
    set(name, value) {
      const slot = slots.get(name);
      if (!slot) return false;
      let src: ArrayLike<number>;
      if (typeof value === 'number') {
        one[0] = value;
        src = one;
      } else {
        src = value;
      }
      write(view, slot.offset, slot.type, src, 0, reflection.structs);
      return true;
    },
  };
}

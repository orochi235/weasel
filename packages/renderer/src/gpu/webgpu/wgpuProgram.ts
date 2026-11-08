/**
 * A WGSL program: its module, the layout of its bind groups reflected from
 * the source, and the values set on it by name, held until set again as GL
 * holds a program's uniforms.
 */
import type {
  GpuProgram, GpuSampling, GpuTexture, GpuUniformArray, GpuUniformData, GpuUniformType,
} from '../types';
import { ShaderStage } from './flags';
import { reflectWgsl, type WgslType } from './wgslReflect';
import { createUniformBlock, type UniformBlock } from './wgslUniforms';
import { reflectEntries, type WgslEntries } from './wgslEntries';
import { CUSTOM_KIT_WGSL_NAMES } from './wgsl/customPrelude';
import { EFFECT_KIT_WGSL_NAMES } from './wgsl/effectPrelude';
import { PAINT_KIT_WGSL_NAMES } from './wgsl/paintPrelude';
import type { WgpuTexture } from './wgpuResources';

/** The kit names a draw sets, and what the custom, effect and paint preludes call them. */
const ALIASES: Readonly<Record<string, string>> = {
  ...CUSTOM_KIT_WGSL_NAMES, ...EFFECT_KIT_WGSL_NAMES, ...PAINT_KIT_WGSL_NAMES,
};

/** The group the viewport fold binds, which the device fills. */
export const NDC_GROUP = 2;

const VISIBILITY = ShaderStage.VERTEX | ShaderStage.FRAGMENT;

/** What a program needs of the device that made it. */
export interface WgpuProgramHost {
  readonly device: GPUDevice;
  readonly ringBuffer: GPUBuffer;
  readonly ndcLayout: GPUBindGroupLayout;
  readonly dummyTexture: WgpuTexture;
  /** Whether the browser lays uniform buffers out under `uniform_buffer_standard_layout`. */
  readonly standardLayout: boolean;
  sampler(sampling: GpuSampling): GPUSampler;
}

interface BlockSlot {
  readonly group: number;
  readonly binding: number;
  readonly block: UniformBlock;
  dirty: boolean;
  /** Where the block was last uploaded in the ring, and in which of its laps. */
  offset: number;
  lap: number;
}

interface Binding {
  readonly binding: number;
  readonly kind: 'uniform' | 'texture' | 'sampler';
  /** A texture's variable, or the texture a sampler samples. */
  readonly texture?: string;
  readonly block?: BlockSlot;
}

/** The GLSL element type of a WGSL array element, as `GpuProgram.array` names it. */
function glslType(t: WgslType, structs: ReturnType<typeof reflectWgsl>['structs']): string {
  switch (t.kind) {
    case 'scalar': return t.scalar === 'f32' ? 'float' : t.scalar === 'i32' ? 'int' : 'uint';
    case 'vector': return `${t.scalar === 'f32' ? '' : t.scalar[0]}vec${t.n}`;
    case 'matrix': return t.cols === t.rows ? `mat${t.cols}` : `mat${t.cols}x${t.rows}`;
    case 'array': return glslType(t.element, structs);
    case 'struct': {
      const only = structs.get(t.name)?.members;
      return only && only.length === 1 ? glslType(only[0].type, structs) : t.name;
    }
  }
}

let nextProgramId = 1;

export class WgpuProgram implements GpuProgram {
  readonly kind = 'program' as const;
  readonly id = nextProgramId++;
  readonly writesIds: boolean;
  readonly module: GPUShaderModule;
  readonly entries: WgslEntries;
  readonly layout: GPUPipelineLayout;
  /** Bind groups 0 and 1, each binding in order. */
  readonly groups: readonly (readonly Binding[])[];
  readonly usesNdc: boolean;
  /** A key's pipeline, or `null` once the GPU refused to make it. */
  readonly pipelines = new Map<string, GPURenderPipeline | null>();
  /** The GPU refused the module or a pipeline of it, which was reported:
   *  a draw with it would void every command submitted beside it. */
  refused = false;
  private readonly groupLayouts: GPUBindGroupLayout[];
  private readonly members = new Map<string, { slot: BlockSlot; member: string }>();
  private readonly arrays = new Map<string, GpuUniformArray>();
  private readonly textures = new Map<string, WgpuTexture | null>();
  private readonly blocks: BlockSlot[] = [];
  private readonly bindGroups = new Map<string, GPUBindGroup>();

  constructor(private readonly host: WgpuProgramHost, readonly code: string) {
    const device = host.device;
    this.module = device.createShaderModule({ code });
    void this.module.getCompilationInfo().then((info) => {
      const errors = info.messages.filter((m) => m.type === 'error');
      if (errors.length > 0) {
        this.refused = true;
        console.error('weasel: a WGSL program failed to compile:\n'
          + errors.map((m) => `${m.lineNum}:${m.linePos} ${m.message}`).join('\n'));
      }
    }, () => {});
    this.entries = reflectEntries(code);
    const reflection = reflectWgsl(code, host);
    const groups: Binding[][] = [[], []];
    let usesNdc = false;
    for (const b of reflection.bindings) {
      if (b.group === NDC_GROUP) {
        usesNdc = true;
        continue;
      }
      if (b.group > 1) throw new Error(`weasel: WGSL binding ${b.name} is in group ${b.group}; programs use groups 0 and 1`);
      const list = groups[b.group];
      if (b.kind === 'uniform') {
        const block = createUniformBlock(reflection, b.struct!);
        const slot: BlockSlot = { group: b.group, binding: b.binding, block, dirty: true, offset: 0, lap: -1 };
        this.blocks.push(slot);
        for (const m of reflection.structs.get(b.struct!)!.members) {
          this.members.set(m.name, { slot, member: m.name });
          if (m.type.kind === 'array') this.arrays.set(m.name, { type: glslType(m.type, reflection.structs), size: m.type.count });
        }
        list.push({ binding: b.binding, kind: 'uniform', block: slot });
      } else if (b.kind === 'texture') {
        this.textures.set(b.name, null);
        list.push({ binding: b.binding, kind: 'texture', texture: b.name });
      } else if (b.kind === 'sampler') {
        list.push({ binding: b.binding, kind: 'sampler', texture: b.name.replace(/_sampler$/, '') });
      } else {
        throw new Error(`weasel: WGSL binding ${b.name} is storage, which the kit does not bind`);
      }
    }
    for (const list of groups) list.sort((a, b) => a.binding - b.binding);
    this.groups = groups;
    this.usesNdc = usesNdc;
    this.collectTextureArrays();
    this.groupLayouts = groups.map((list) => device.createBindGroupLayout({ entries: list.map((b) => layoutEntry(b)) }));
    this.layout = device.createPipelineLayout({
      bindGroupLayouts: usesNdc ? [...this.groupLayouts, host.ndcLayout] : this.groupLayouts,
    });
    this.writesIds = this.resolve('u_weaselId') !== undefined;
  }

  /** `u_samplers_0`… answer to `u_samplers` as GLSL's sampler array does. */
  private collectTextureArrays(): void {
    const counts = new Map<string, number>();
    for (const name of this.textures.keys()) {
      const m = /^(\w+)_(\d+)$/.exec(name);
      if (m) counts.set(m[1], Math.max(counts.get(m[1]) ?? 0, Number(m[2]) + 1));
    }
    for (const [name, size] of counts) this.arrays.set(name, { type: 'sampler2D', size });
  }

  /** Stop drawing with the pipeline of `key` once the GPU's refusal of it
   *  arrives, reporting the first refusal. */
  refusePipeline(key: string, message: string): void {
    this.pipelines.set(key, null);
    if (this.refused) return;
    this.refused = true;
    console.error(`weasel: the GPU refused a WGSL program's pipeline, which then draws nothing: ${message}`);
  }

  /** The block member `name` writes: a member, an alias of one, or one slot of an array member (`u_ripples[2]`). */
  private resolve(name: string): { slot: BlockSlot; member: string } | undefined {
    const hit = this.members.get(name) ?? (ALIASES[name] ? this.members.get(ALIASES[name]) : undefined);
    if (hit || !name.endsWith(']')) return hit;
    const m = /^(\w+)\[(\d+)\]$/.exec(name);
    const base = m ? this.resolve(m[1]) : undefined;
    if (!base) return undefined;
    const member = `${base.member}[${m![2]}]`;
    return base.slot.block.has(member) ? { slot: base.slot, member } : undefined;
  }

  private textureName(name: string, index: number): string | undefined {
    const base = this.textures.has(name) ? name : ALIASES[name] && this.textures.has(ALIASES[name]) ? ALIASES[name] : undefined;
    if (base !== undefined && index === 0) return base;
    const slot = `${name}_${index}`;
    return this.textures.has(slot) ? slot : undefined;
  }

  lookupUniforms(): void {}
  lookupUniformArrays(): void {}
  lookupAttributes(): void {}

  has(name: string): boolean {
    return this.resolve(name) !== undefined || this.textureName(name, 0) !== undefined;
  }

  array(name: string): GpuUniformArray | undefined {
    return this.arrays.get(name) ?? (ALIASES[name] ? this.arrays.get(ALIASES[name]) : undefined);
  }

  attribute(name: string): number | undefined {
    return this.entries.attributes.get(name);
  }

  private write(name: string, value: number | ArrayLike<number>): void {
    const at = this.resolve(name);
    if (at && at.slot.block.set(at.member, value)) at.slot.dirty = true;
  }

  set1f(name: string, x: number): void {
    this.write(name, x);
  }

  set2f(name: string, x: number, y: number): void {
    this.write(name, [x, y]);
  }

  set4f(name: string, x: number, y: number, z: number, w: number): void {
    this.write(name, [x, y, z, w]);
  }

  set1i(name: string, x: number): void {
    this.write(name, x);
  }

  set(name: string, _type: GpuUniformType, data: GpuUniformData, offset?: number, count?: number): void {
    if (offset === undefined && count === undefined) {
      this.write(name, data);
      return;
    }
    const from = offset ?? 0;
    const to = count === undefined ? data.length : from + count;
    this.write(name, Array.prototype.slice.call(data, from, to) as number[]);
  }

  setTexture(name: string, texture: GpuTexture | null, index = 0): void {
    const slot = this.textureName(name, index);
    if (slot !== undefined) this.textures.set(slot, texture as WgpuTexture | null);
  }

  /** Bytes the next draw uploads: every block changed since it was last
   *  uploaded, or uploaded in an earlier lap of the ring. */
  uploadBytes(lap: number, align: number): number {
    let total = 0;
    for (const s of this.blocks) if (s.dirty || s.lap !== lap) total += Math.ceil(s.block.size / align) * align;
    return total;
  }

  /** Copy the blocks `uploadBytes` counted into the ring's mirror from `at`. */
  upload(mirror: Uint8Array, at: number, lap: number, align: number): void {
    for (const s of this.blocks) {
      if (!s.dirty && s.lap === lap) continue;
      mirror.set(new Uint8Array(s.block.bytes, 0, s.block.size), at);
      s.offset = at;
      s.lap = lap;
      s.dirty = false;
      at += Math.ceil(s.block.size / align) * align;
    }
  }

  /** The dynamic offsets of group `g`, in binding order. */
  offsets(g: number): number[] {
    const out: number[] = [];
    for (const b of this.groups[g]) if (b.block) out.push(b.block.offset);
    return out;
  }

  /** Every texture group `g` samples, the dummy where none is set or the one
   *  set is `attached` to the pass drawing. */
  boundTextures(g: number, attached: ReadonlySet<WgpuTexture>): WgpuTexture[] {
    const out: WgpuTexture[] = [];
    for (const b of this.groups[g]) {
      if (b.kind === 'uniform') continue;
      const t = this.textures.get(b.texture!) ?? null;
      out.push(t && !attached.has(t) ? t : this.host.dummyTexture);
    }
    return out;
  }

  /** Group `g` over `textures`, as `boundTextures` gave them. */
  bindGroup(g: number, textures: readonly WgpuTexture[]): GPUBindGroup {
    const key = textures.map((t) => `${t.id}.${t.version}.${t.sampling.min}${t.sampling.mag}${t.sampling.mipmap ? 1 : 0}${t.sampling.wrapS}${t.sampling.wrapT}`).join('|');
    const cacheKey = `${g}:${key}`;
    let group = this.bindGroups.get(cacheKey);
    if (group) return group;
    let i = 0;
    const entries: GPUBindGroupEntry[] = this.groups[g].map((b) => {
      if (b.kind === 'uniform') {
        return { binding: b.binding, resource: { buffer: this.host.ringBuffer, size: b.block!.block.size } };
      }
      const t = textures[i++];
      if (b.kind === 'texture') return { binding: b.binding, resource: t.view };
      return { binding: b.binding, resource: this.host.sampler(t.sampling) };
    });
    if (this.bindGroups.size > 256) this.bindGroups.clear();
    group = this.host.device.createBindGroup({ layout: this.groupLayouts[g], entries });
    this.bindGroups.set(cacheKey, group);
    return group;
  }
}

function layoutEntry(b: Binding): GPUBindGroupLayoutEntry {
  if (b.kind === 'uniform') {
    return { binding: b.binding, visibility: VISIBILITY, buffer: { type: 'uniform', hasDynamicOffset: true, minBindingSize: b.block!.block.size } };
  }
  if (b.kind === 'texture') return { binding: b.binding, visibility: VISIBILITY, texture: { sampleType: 'float' } };
  return { binding: b.binding, visibility: VISIBILITY, sampler: { type: 'filtering' } };
}

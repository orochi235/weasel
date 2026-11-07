/** Render pipelines, made once per program for each state a draw asks of it.
 *  WebGPU bakes blend, write masks and stencil compare, masks and op into a
 *  pipeline; only the stencil reference is set per draw. */
import type { BlendFactor, BlendFactors } from '../../effects/compositeOp';
import type { GpuDrawState, GpuStencilState } from '../types';
import { ColorWrite } from './flags';
import type { WgpuGeometry } from './wgpuResources';
import type { WgpuProgram } from './wgpuProgram';
import { DEPTH_STENCIL, type PassAttachments } from './wgpuTargets';

const FACTORS: Readonly<Record<BlendFactor, GPUBlendFactor>> = {
  zero: 'zero', one: 'one', 'source-alpha': 'src-alpha', 'one-minus-source-alpha': 'one-minus-src-alpha',
  'destination-alpha': 'dst-alpha', 'one-minus-destination-alpha': 'one-minus-dst-alpha',
};

const STENCIL_OPS: Readonly<Record<GpuStencilState['pass'], GPUStencilOperation>> = {
  keep: 'keep', replace: 'replace', invert: 'invert', zero: 'zero',
};

/** Where a program reads an attribute no buffer of the geometry holds, the
 *  constant (0, 0, 0, 1), as GL reads a disabled attribute. */
export const DEFAULT_ATTRIBUTE = new Float32Array([0, 0, 0, 1]);

function blendOf(blend: BlendFactors | null): GPUBlendState | undefined {
  if (!blend) return undefined;
  const component: GPUBlendComponent = { srcFactor: FACTORS[blend.source], dstFactor: FACTORS[blend.destination], operation: 'add' };
  return { color: component, alpha: component };
}

/** The stencil a draw is drawn under, `null` neither testing nor writing. */
export function stencilState(stencil: GpuStencilState | null): Pick<GPUDepthStencilState, 'stencilFront' | 'stencilBack' | 'stencilReadMask' | 'stencilWriteMask'> {
  const face: GPUStencilFaceState = stencil
    ? { compare: stencil.compare, failOp: 'keep', depthFailOp: 'keep', passOp: STENCIL_OPS[stencil.pass] }
    : { compare: 'always', failOp: 'keep', depthFailOp: 'keep', passOp: 'keep' };
  return {
    stencilFront: face, stencilBack: face,
    stencilReadMask: stencil?.readMask ?? 0xFF, stencilWriteMask: stencil?.writeMask ?? 0,
  };
}

function stateKey(state: GpuDrawState): string {
  const b = state.blend ? `${state.blend.source}/${state.blend.destination}` : '-';
  const s = state.stencil
    ? `${state.stencil.compare}${state.stencil.readMask}.${state.stencil.writeMask}${state.stencil.pass}`
    : '-';
  return `${b}|${state.colorWrite ? 'c' : ''}${state.ids ? 'i' : ''}|${s}`;
}

/** The locations `program` reads that `geometry` does not feed. */
function missingInputs(program: WgpuProgram, geometry: WgpuGeometry): number[] {
  return program.entries.inputs.filter((l) => !geometry.locations.has(l));
}

/** The vertex buffers a draw binds after the geometry's own: one holding
 *  `DEFAULT_ATTRIBUTE`, where the program reads what the geometry lacks. */
export function needsDefaultAttribute(program: WgpuProgram, geometry: WgpuGeometry): boolean {
  return missingInputs(program, geometry).length > 0;
}

/** The pipeline a draw of `program` is drawn with, or `null` where the GPU
 *  refused it: an invalid pipeline set on a pass voids the whole submit. */
export function pipelineFor(
  device: GPUDevice, program: WgpuProgram, geometry: WgpuGeometry, target: PassAttachments, state: GpuDrawState,
): GPURenderPipeline | null {
  const key = `${geometry.layoutKey}|${target.key}|${stateKey(state)}`;
  let pipeline = program.pipelines.get(key);
  if (pipeline !== undefined) return pipeline;
  const missing = missingInputs(program, geometry);
  const buffers: GPUVertexBufferLayout[] = [...geometry.layouts];
  if (missing.length > 0) {
    buffers.push({
      arrayStride: 16, stepMode: 'instance',
      attributes: missing.map((shaderLocation) => ({ shaderLocation, offset: 0, format: 'float32x4' as const })),
    });
  }
  const outputs = program.entries.outputs;
  const blend = blendOf(state.blend);
  const targets: GPUColorTargetState[] = [{
    format: target.format, blend, writeMask: state.colorWrite && outputs.has(0) ? ColorWrite.ALL : 0,
  }];
  if (target.hasIds) targets.push({ format: 'rgba8unorm', blend, writeMask: state.ids && outputs.has(1) ? ColorWrite.ALL : 0 });
  device.pushErrorScope('validation');
  pipeline = device.createRenderPipeline({
    layout: program.layout,
    vertex: { module: program.module, entryPoint: program.entries.vertex, buffers },
    fragment: { module: program.module, entryPoint: program.entries.fragment, targets },
    primitive: { topology: 'triangle-list', cullMode: 'none' },
    multisample: { count: target.sampleCount },
    ...(target.stencil && {
      depthStencil: { format: DEPTH_STENCIL, depthWriteEnabled: false, depthCompare: 'always', ...stencilState(state.stencil) },
    }),
  });
  void device.popErrorScope().then((error) => {
    if (!error) return;
    program.refusePipeline(key, error.message);
    // Handed on as the scope found it, so a listener for uncaptured errors still hears it.
    if (typeof GPUUncapturedErrorEvent !== 'undefined') device.dispatchEvent(new GPUUncapturedErrorEvent('uncapturederror', { error }));
  }, () => {});
  program.pipelines.set(key, pipeline);
  return pipeline;
}

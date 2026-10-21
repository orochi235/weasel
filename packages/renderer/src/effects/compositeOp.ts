/**
 * How an isolated group's finished surface joins what is already drawn.
 *
 * Every color the renderer writes is premultiplied, so each Porter-Duff
 * operator is `source * Fa + destination * Fb` with both factors read off one
 * alpha or the other, which is a blend function and needs no second pass.
 */
import type { DrawCommand } from '../DrawCommand';

/** A Porter-Duff operator, named as canvas 2D's `globalCompositeOperation` names it. */
export type CompositeOp =
  | 'source-over' | 'source-in' | 'source-out' | 'source-atop'
  | 'destination-over' | 'destination-in' | 'destination-out' | 'destination-atop'
  | 'xor' | 'lighter' | 'copy';

/** What one side of the blend is scaled by. */
export type BlendFactor =
  | 'zero' | 'one'
  | 'source-alpha' | 'one-minus-source-alpha'
  | 'destination-alpha' | 'one-minus-destination-alpha';

/** An operator with no name: `source * source + destination * destination`, on premultiplied color. */
export interface BlendFactors {
  source: BlendFactor;
  destination: BlendFactor;
}

const OPERATORS: Readonly<Record<CompositeOp, BlendFactors>> = {
  'source-over': { source: 'one', destination: 'one-minus-source-alpha' },
  'source-in': { source: 'destination-alpha', destination: 'zero' },
  'source-out': { source: 'one-minus-destination-alpha', destination: 'zero' },
  'source-atop': { source: 'destination-alpha', destination: 'one-minus-source-alpha' },
  'destination-over': { source: 'one-minus-destination-alpha', destination: 'one' },
  'destination-in': { source: 'zero', destination: 'source-alpha' },
  'destination-out': { source: 'zero', destination: 'one-minus-source-alpha' },
  'destination-atop': { source: 'one-minus-destination-alpha', destination: 'source-alpha' },
  xor: { source: 'one-minus-destination-alpha', destination: 'one-minus-source-alpha' },
  lighter: { source: 'one', destination: 'one' },
  copy: { source: 'one', destination: 'zero' },
};

/** The factor pair `composite` stands for. */
export function blendFactorsOf(composite: CompositeOp | BlendFactors): BlendFactors {
  return typeof composite === 'string' ? OPERATORS[composite] : composite;
}

/** Whether `composite` is anything but the renderer's ordinary blend. */
export function isOwnComposite(composite: CompositeOp | BlendFactors | undefined): boolean {
  if (composite === undefined) return false;
  const { source, destination } = blendFactorsOf(composite);
  return source !== 'one' || destination !== 'one-minus-source-alpha';
}

/**
 * Whether `composite` leaves the destination as it was wherever the source is
 * empty, so what it changes lies inside what its group draws. The others clear
 * or scale everything else inside the enclosing clip.
 */
export function leavesUncovered(composite: CompositeOp | BlendFactors): boolean {
  const { destination } = blendFactorsOf(composite);
  return destination === 'one' || destination === 'one-minus-source-alpha';
}

/** Keyed by array: the lists a renderer draws are not mutated once drawn. */
const backdropReaders = new WeakMap<readonly DrawCommand[], boolean>();

/** Whether any group in `commands`, at any depth, has its own composite, and so reads the pixels drawn before it. */
export function readsBackdrop(commands: readonly DrawCommand[]): boolean {
  const known = backdropReaders.get(commands);
  if (known !== undefined) return known;
  const reads = commands.some((cmd) => cmd.kind === 'group' && (isOwnComposite(cmd.composite) || readsBackdrop(cmd.children)));
  backdropReaders.set(commands, reads);
  return reads;
}

function glFactor(gl: WebGL2RenderingContext, factor: BlendFactor): number {
  switch (factor) {
    case 'zero': return gl.ZERO;
    case 'one': return gl.ONE;
    case 'source-alpha': return gl.SRC_ALPHA;
    case 'one-minus-source-alpha': return gl.ONE_MINUS_SRC_ALPHA;
    case 'destination-alpha': return gl.DST_ALPHA;
    case 'one-minus-destination-alpha': return gl.ONE_MINUS_DST_ALPHA;
  }
}

/** Set the blend function `composite` stands for. */
export function applyComposite(gl: WebGL2RenderingContext, composite: CompositeOp | BlendFactors): void {
  const { source, destination } = blendFactorsOf(composite);
  gl.blendFunc(glFactor(gl, source), glFactor(gl, destination));
}

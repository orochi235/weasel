export type Kernel = readonly (readonly [dx: number, dy: number, weight: number])[];

export const FLOYD_STEINBERG: Kernel = [];
export const ATKINSON: Kernel = [];

export function diffuse(
  _gray: Float32Array, _width: number, _height: number, _threshold: number,
  _kernel: Kernel, _denominator: number, _protect: Uint8Array | null,
): Uint8Array {
  throw new Error('diffuse: not implemented');
}

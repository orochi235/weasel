/** Throw for an index outside a sampler of `size` elements, which on WebGL would write another sampler's unit. */
export function checkSamplerIndex(name: string, index: number, size: number): void {
  if (Number.isInteger(index) && index >= 0 && index < size) return;
  throw new RangeError(`weasel: setTexture('${name}', …, ${index}) is outside the sampler's ${size} element(s)`);
}

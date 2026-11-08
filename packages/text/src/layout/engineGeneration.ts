/**
 * How many times the registered layout engines (`registerBidi`,
 * `registerShaper`) have changed: the pull-based signal for caches keyed on
 * `glyphGeneration()` or `faceGeneration()`, which a registration does not
 * move, though it changes where every glyph goes. Compare with `!==`.
 */
let generation = 0;

export function textEngineGeneration(): number {
  return generation;
}

/** In-package: a registry's engine changed. */
export function bumpTextEngineGeneration(): void {
  generation++;
}

import type { EffectStage } from '../types';

/** A stage's params by id (label when it has none), each its control's value or its display value. */
export function paramValues(stage: EffectStage): Record<string, unknown> {
  return Object.fromEntries((stage.params ?? []).map((p) => [p.id ?? p.label, p.control?.value ?? p.value]));
}

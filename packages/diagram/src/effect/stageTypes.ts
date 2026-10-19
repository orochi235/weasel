import type { EffectParam, EffectParamControl, EffectPort, EffectStage } from './types';

/** A palette entry: a stage's ports and params, ready to be copied into a pipeline. */
export interface EffectStageType {
  type: string;
  title: string;
  kind?: string;
  inputs?: readonly EffectPort[];
  outputs?: readonly EffectPort[];
  params?: readonly EffectParam[];
}

/** A stage of type `t` with its own copy of the ports and params; no link back. */
export function stageFromType(t: EffectStageType, id: string): EffectStage {
  const stage: EffectStage = { id, title: t.title, type: t.type };
  if (t.kind !== undefined) stage.kind = t.kind;
  if (t.inputs) stage.inputs = t.inputs.map((p) => ({ ...p }));
  if (t.outputs) stage.outputs = t.outputs.map((p) => ({ ...p }));
  if (t.params) stage.params = t.params.map((p) => ({ ...p, ...(p.control ? { control: structuredClone(p.control) } : {}) }));
  return stage;
}

/** The places after the point `step` is written with, which a multiple of it needs. */
function stepPlaces(step: number): number {
  const text = String(step);
  if (text.includes('e')) return Math.min(20, Math.max(0, -Math.floor(Math.log10(step))));
  const dot = text.indexOf('.');
  return dot === -1 ? 0 : text.length - dot - 1;
}

/** The display string for a control's value, to as many places as its `step` has (one without a step). */
export function formatParam(control: EffectParamControl): string {
  switch (control.kind) {
    case 'number': {
      const n = control.value.toFixed(control.step === undefined ? 1 : stepPlaces(control.step)).replace(/^-(?=[0.]*$)/, '');
      return control.unit ? `${n} ${control.unit}` : n;
    }
    case 'enum':
      return control.options.find((x) => x.value === control.value)?.label ?? control.value;
    case 'boolean':
      return control.value ? 'on' : 'off';
    case 'string':
      return control.value;
  }
}

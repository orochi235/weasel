import { setParam, type EffectDoc, type EffectParam, type EffectParamControl } from '@weasel-js/diagram/effect';
import { PropertyField, PropertyList, PropertyNote, PropertyPanel } from '@weasel-js/ui/components/Properties';
import type { ReactElement } from 'react';
import type { PipelineDoc } from './usePipelineDoc';

export interface ParamPanelProps {
  doc: EffectDoc;
  /** The selected stage's id, or null. */
  selected: string | null;
  change: PipelineDoc['change'];
}

/** The field for one param: its control's kind, or its display value read-only when it has none. */
function ParamField({ param, set }: { param: EffectParam; set: (c: EffectParamControl) => void }): ReactElement {
  const c = param.control;
  const label = param.label;
  switch (c?.kind) {
    case 'number':
      return (
        <PropertyField
          kind="number" control="slider" label={label} value={c.value}
          {...(c.min !== undefined ? { min: c.min } : {})}
          {...(c.max !== undefined ? { max: c.max } : {})}
          {...(c.step !== undefined ? { step: c.step } : {})}
          {...(c.unit !== undefined ? { unit: c.unit } : {})}
          onChange={(value) => set({ ...c, value })}
        />
      );
    case 'enum':
      return (
        <PropertyField
          kind="enum" control="select" label={label} value={c.value}
          options={c.options.map((o) => ({ value: o.value, label: o.label ?? o.value }))}
          onChange={(value) => set({ ...c, value })}
        />
      );
    case 'boolean':
      return <PropertyField kind="boolean" control="switch" label={label} value={c.value} onChange={(value) => set({ ...c, value })} />;
    case 'string':
      return <PropertyField kind="string" control="input" label={label} value={c.value} onChange={(value) => set({ ...c, value })} />;
    case undefined:
      return <PropertyField kind="string" label={label} value={param.value} readOnly onChange={() => {}} />;
  }
}

/** The selected stage's params, each edited through its control and recorded as 'Set <label>'. */
export function ParamPanel({ doc, selected, change }: ParamPanelProps): ReactElement {
  const stage = selected === null ? undefined : doc.pipeline.stages.find((s) => s.id === selected);
  const params = stage?.params ?? [];
  return (
    <PropertyPanel title={stage ? `${stage.title} params` : 'Params'}>
      <PropertyList>
        {stage === undefined && <PropertyNote>Select a stage to edit its params.</PropertyNote>}
        {stage !== undefined && params.length === 0 && <PropertyNote>This stage has no params.</PropertyNote>}
        {stage !== undefined && params.map((p) => {
          const key = p.id ?? p.label;
          const set = (control: EffectParamControl) =>
            change(setParam(doc, stage.id, key, control), `Set ${p.label}`, `${stage.id}:${key}`);
          return <ParamField key={key} param={p} set={set} />;
        })}
      </PropertyList>
    </PropertyPanel>
  );
}

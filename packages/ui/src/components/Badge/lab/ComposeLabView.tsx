import { useState } from 'react';
import { Badge } from '@weasel-js/ui/components/Badge';
import { lookProps } from '../looks';
import type { BadgeBase } from '@weasel-js/ui/components/Badge';
import { AppearanceSection } from './AppearanceSection';
import { BaseParams } from './BaseParams';
import { BASE_KEYS } from './controls';
import { EffectsSection } from './EffectsSection';
import { LAB_PRESETS, type LabPreset } from './presets';
import { Preview } from './Preview';
import type { LabSnapshot } from './snapshot';
import { composeSnippet } from './snippets';
import { addEffect, basePatch, presetPatch, resetPatch } from './transitions';
import { TypeSection } from './TypeSection';
import { useLabState, type LabArgs } from './useLabState';
import controls from './controls.stories.module.css';
import s from './ComposeLab.stories.module.css';

type Dressed = Pick<LabSnapshot, 'look' | 'tint' | 'variant' | 'bloat' | 'size' | 'label'>;

/** Every preset, drawn in the lab's current colors and label; a click loads one. */
function Presets({ lab, onLoad }: { lab: Dressed; onLoad: (preset: LabPreset) => void }) {
  return (
    <section className={`${s.section} ${s.presets}`}>
      <h3 className={`${s.sectionTitle} ${s.presetsTitle}`}>Presets</h3>
      <div className={s.presetList}>
        {LAB_PRESETS.map((p) => (
          <button key={p.name} className={s.preset} onClick={() => onLoad(p)} title={`Load ${p.name}`}>
            <Badge
              base={p.base}
              baseParams={p.baseParams as never}
              effects={p.effects as never}
              {...lookProps(lab.look, lab.tint)}
              variant={lab.variant}
              bloat={lab.bloat}
              size={lab.size}
            >
              {lab.label}
            </Badge>
            <code className={s.presetName}>{p.name}</code>
          </button>
        ))}
      </div>
    </section>
  );
}

/**
 * A workbench for composing a badge from a base and a stack of effects. It
 * keeps its state in local storage, undoes and redoes on the platform's
 * history keys, and writes the `<Badge>` JSX for what it shows.
 */
export function ComposeLabView(args: LabArgs) {
  const [lab, change] = useLabState(args);
  const [snippet, setSnippet] = useState<string | null>(null);
  const copySnippet = () => {
    const text = composeSnippet(lab);
    setSnippet(text);
    if (typeof navigator !== 'undefined' && navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
  };
  return (
    <div className={s.lab}>
      <div className={s.columns}>
        <div className={s.stack}>
          <Preview lab={lab} onZoom={(zoom) => change({ zoom })} />
          <div className={s.actions}>
            <button className={controls.button} onClick={copySnippet}>Copy snippet</button>
            <button className={controls.button} onClick={() => { change(resetPatch()); setSnippet(null); }}>Reset</button>
          </div>
          {snippet && <textarea readOnly className={controls.snippet} value={snippet} rows={Math.min(20, snippet.split('\n').length + 1)} />}
          <section className={s.section}>
            <label className={`${controls.row} ${controls.wide2}`}>
              <span className={s.baseLabel}>base</span>
              <select className={s.baseSelect} value={lab.base} onChange={(e) => change(basePatch(e.target.value as BadgeBase))}>
                {BASE_KEYS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </label>
          </section>
          <div className={s.triple}>
            <AppearanceSection value={lab} onChange={change} />
            <TypeSection value={lab} onChange={change} />
            <section className={s.section}>
              <BaseParams
                base={lab.base}
                params={lab.baseParams}
                onChange={(update) => change((snap) => ({ baseParams: update(snap.baseParams) }))}
              />
            </section>
          </div>
        </div>
        <div className={s.stack}>
          <EffectsSection
            effects={lab.labEffects}
            onAdd={(type) => change((snap) => addEffect(snap, type))}
            onEffects={(update) => change((snap) => ({ labEffects: update(snap.labEffects) }))}
          />
        </div>
      </div>
      <Presets
        lab={lab}
        onLoad={(preset) => {
          change((snap) => presetPatch(preset, snap.nextId));
          setSnippet(null);
        }}
      />
    </div>
  );
}

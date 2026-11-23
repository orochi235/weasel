/**
 * The State tab: selection, view, the active tool and the overlay flags, with
 * the two the panel may steer. Overlay flags and probes change with no notice,
 * so this also polls while the tab is open.
 */
import { useRef, type ReactElement } from 'react';
import { DEBUG_FEATURES } from '@weasel-js/core';
import { Code } from '@weasel-js/ui/components/Code';
import { Select } from '@weasel-js/ui/components/Select';
import { CheckboxGroup } from '@weasel-js/ui/components/CheckboxGroup';
import { usePoll, useRootQuery } from '../hooks';
import type { DevtoolsViewProps } from '../tabs';
import { ValueView } from './ValueView';
import s from './StateView.module.css';

/** The tool picker's value for "no tool": a select key cannot be null. */
const NO_TOOL = '\u0000none';

const POLL_MS = 500;

export function StateView({ client, rootId }: DevtoolsViewProps): ReactElement {
  const state = useRootQuery(client, rootId, ['selection', 'view', 'tool'], () => client.request(rootId, { type: 'get-state' }));
  usePoll(state.refresh, POLL_MS, true);
  const steered = useRef(new Set<string>());
  if (state.error) return <p className={s.note}>{state.error}</p>;
  const st = state.data;
  if (!st) return <p className={s.note}>Loading…</p>;

  const steer = (p: Promise<unknown>): void => { p.then(state.refresh, state.refresh); };
  const probes = Object.entries(st.probes);

  return (
    <div className={s.state}>
      <section className={s.section} aria-label="Selection">
        <h3 className={s.heading}>Selection <span className={s.count}>{st.selection.length}</span></h3>
        {st.selection.length === 0
          ? <p className={s.note}>Nothing selected.</p>
          : <div className={s.ids}>{st.selection.map((id) => <Code key={id} size="sm">{id}</Code>)}</div>}
      </section>

      <section className={s.section} aria-label="Tool">
        <h3 className={s.heading}>Tool</h3>
        <Select
          aria-label="Active tool"
          width="fit"
          selectedKey={st.activeTool ?? NO_TOOL}
          onSelectionChange={(key) => {
            steer(client.request(rootId, { type: 'set-tool', toolId: key === NO_TOOL ? null : key }));
          }}
          options={[{ value: NO_TOOL, label: 'none' }, ...st.tools.map((t) => ({ value: t, label: t }))]}
        />
      </section>

      <section className={s.section} aria-label="Overlays">
        <h3 className={s.heading}>Overlays</h3>
        <CheckboxGroup
          aria-label="Overlays"
          control="switch"
          orientation="horizontal"
          sweep
          items={DEBUG_FEATURES.map((flag) => ({ value: flag, label: flag }))}
          value={DEBUG_FEATURES.filter((flag) => st.overlays[flag] === true)}
          // A flag steered once is resent with every step: a sweep's later steps are diffed against a stale render.
          onChange={(on) => {
            const changed = DEBUG_FEATURES.filter((flag) => steered.current.has(flag) || on.includes(flag) !== (st.overlays[flag] === true));
            for (const flag of changed) steered.current.add(flag);
            const overlays = Object.fromEntries(changed.map((flag) => [flag, on.includes(flag)]));
            steer(client.request(rootId, { type: 'set-overlays', overlays }));
          }}
        />
      </section>

      <section className={s.section} aria-label="View">
        <h3 className={s.heading}>View</h3>
        <ValueView value={st.view} label="View" />
      </section>

      <section className={s.section} aria-label="Probes">
        <h3 className={s.heading}>Probes</h3>
        {probes.length === 0
          ? <p className={s.note}>No probes registered.</p>
          : probes.map(([name, value]) => (
            <div key={name} className={s.probe}>
              <Code size="sm">{name}</Code>
              <ValueView value={value} label={name} />
            </div>
          ))}
      </section>
    </div>
  );
}

/** The State tab: selection, view, the active tool and the overlay flags, with the two the panel may steer. */
import type { ReactElement } from 'react';
import { DEBUG_FEATURES } from '@weasel-js/core';
import { Code } from '@weasel-js/ui/components/Code';
import { Select } from '@weasel-js/ui/components/Select';
import { Switch } from '@weasel-js/ui/components/Switch';
import { useRootQuery } from '../hooks';
import type { DevtoolsViewProps } from '../tabs';
import { ValueView } from './ValueView';
import s from './StateView.module.css';

/** The tool picker's value for "no tool": a select key cannot be null. */
const NO_TOOL = '\u0000none';

export function StateView({ client, rootId }: DevtoolsViewProps): ReactElement {
  const state = useRootQuery(client, rootId, ['selection', 'view', 'tool'], () => client.request(rootId, { type: 'get-state' }));
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
        <div className={s.flags}>
          {DEBUG_FEATURES.map((flag) => (
            <Switch
              key={flag}
              isSelected={st.overlays[flag] === true}
              onChange={(on) => steer(client.request(rootId, { type: 'set-overlays', overlays: { [flag]: on } }))}
            >
              {flag}
            </Switch>
          ))}
        </div>
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

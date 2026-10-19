/** An entry's gesture bindings: each route drawn in the route grammar, beside the action it reaches. */
import type { ReactElement } from 'react';
import type { DevtoolsBinding } from '@weasel-js/core/devtools-protocol';
import { Code } from '@weasel-js/ui/components/Code';
import { GestureRoute } from '@weasel-js/ui/components/GestureRoute';
import { ValueView } from './ValueView';
import s from './RegistryView.module.css';

const hasOpts = (b: DevtoolsBinding): boolean =>
  typeof b.opts === 'object' && b.opts !== null && Object.keys(b.opts).length > 0;

export function Bindings({ bindings }: { bindings: readonly DevtoolsBinding[] }): ReactElement {
  return (
    <section className={s.section} aria-label="Bindings">
      <h3 className={s.heading}>Bindings <span className={s.count}>{bindings.length}</span></h3>
      {bindings.length === 0 ? <p className={s.note}>None.</p> : (
        <ul className={s.bindings}>
          {bindings.map((b, i) => (
            <li key={i} className={s.binding}>
              <span className={s.routes}>
                {b.routes.length > 0
                  ? b.routes.map((r) => <GestureRoute key={r} route={r} size="sm" />)
                  : <ValueView value={b.spec} label="Spec" />}
              </span>
              <span className={s.arrow} aria-hidden>→</span>
              <Code size="sm">{b.actionId}</Code>
              {hasOpts(b) && <ValueView value={b.opts} label={`Options for ${b.actionId}`} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

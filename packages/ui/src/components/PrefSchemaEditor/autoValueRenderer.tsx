import type { ReactNode } from 'react';
import type { PrefRenderContext, PrefRenderer } from '../Prefs';
import { Switch } from '../Switch';
import s from './PrefSchemaEditor.module.css';

/** The Auto panel's value row: a switch that sets it, beside its control. Unset, the control shows the default it would
 *  start from and takes no input. */
export function autoValueRenderer(unset: boolean, onSet: (on: boolean) => void, control: (ctx: PrefRenderContext) => ReactNode): PrefRenderer {
  return Object.assign<PrefRenderer, { group: boolean }>((ctx) => (
    <span className={s.autoValue}>
      <Switch aria-label={`Set ${ctx.pref.name}`} isSelected={!unset} onChange={onSet} />
      <fieldset className={s.autoValueControl} disabled={unset}>
        {control(ctx)}
      </fieldset>
    </span>
  ), { group: true });
}

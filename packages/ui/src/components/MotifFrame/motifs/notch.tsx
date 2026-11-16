import { withMotifClass, twistySides } from '../root';
import type { Motif } from '../types';
import s from './notch.module.css';

/** Params for {@link notch}. */
export interface NotchParams {
  /** Where the title cuts the top border. Defaults to `'center'`; actions hold it at the start. */
  align?: 'center' | 'start';
}

/** The title cut into the top border, the way an NES-era panel labels itself. */
export function notch(params: NotchParams = {}): Motif<NotchParams> {
  const { align = 'center' } = params;
  return {
    id: 'notch',
    params,
    render({ heading: { title, titleId, inline, note, twisty, twistyAt, leading, actions }, body, root }) {
      const fold = twistySides({ twisty, twistyAt });
      return (
        <fieldset {...withMotifClass(root, s.notch)}>
          <legend className={s.legend} data-align={align} data-actions={actions === undefined ? undefined : ''}>
            {fold.start}
            {leading}
            <span id={titleId} className={s.label}>
              {title}
            </span>
            {inline}
            {actions === undefined ? null : (
              <>
                <span className={s.run} aria-hidden="true" />
                <span className={s.actions}>{actions}</span>
              </>
            )}
            {fold.end}
          </legend>
          {note}
          {body}
        </fieldset>
      );
    },
  };
}

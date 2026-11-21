import { drawn, headed, withMotifClass, twistySides } from '../root';
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
    render({ heading, body, root }) {
      const { title, titleId, inline, note, twisty, twistyAt, leading, actions } = heading;
      const fold = twistySides({ twisty, twistyAt });
      return (
        // A fieldset is a group named by its legend, so an untitled one would be named by its controls.
        <fieldset {...withMotifClass(root, s.notch)} role={root.role ?? 'none'}>
          {headed(heading) && (
            <legend className={s.legend} data-align={align} data-actions={drawn(actions) ? '' : undefined}>
              {fold.start}
              {leading}
              {drawn(title) && (
                <span id={titleId} className={s.label}>
                  {title}
                </span>
              )}
              {inline}
              {drawn(actions) && (
                <>
                  <span className={s.run} aria-hidden="true" />
                  <span className={s.actions}>{actions}</span>
                </>
              )}
              {fold.end}
            </legend>
          )}
          {note}
          {body}
        </fieldset>
      );
    },
  };
}

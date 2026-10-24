import { headingTag, withMotifClass } from '../root';
import type { Motif } from '../types';
import s from './well.module.css';

/** Params for {@link well}. */
export interface WellParams {
  /** `'box'` outlines the whole well; `'start'` draws only a rule down its leading edge. Defaults to `'box'`. */
  edge?: 'box' | 'start';
  /** A rule under the heading, between it and the body. */
  ruled?: boolean;
}

/**
 * A sunken well holding its heading and body in a column: the look of a
 * settings form's groups. Its spacing and its title's type are read from
 * `--wzl-well-*` properties, so each surface that draws one sets its own.
 */
export function well(params: WellParams = {}): Motif<WellParams> {
  const { edge = 'box', ruled = false } = params;
  return {
    id: 'well',
    params,
    render({ heading: { title, titleId, inline, note, level, twisty, leading, actions }, body, root }) {
      const Heading = headingTag(level, 3);
      const row = title != null || twisty != null || leading != null || actions != null;
      return (
        <div {...withMotifClass(root, s.well)} data-edge={edge}>
          {(row || note != null) && (
            <div className={s.head} data-ruled={ruled ? '' : undefined}>
              {row && (
                <div className={s.row}>
                  {twisty}
                  {leading}
                  {title != null && (
                    <Heading className={s.title} aria-labelledby={inline === undefined ? undefined : titleId}>
                      <span id={titleId}>{title}</span>
                      {inline}
                    </Heading>
                  )}
                  {actions != null && <span className={s.actions}>{actions}</span>}
                </div>
              )}
              {note != null && <div className={s.note}>{note}</div>}
            </div>
          )}
          {body}
        </div>
      );
    },
  };
}

import { drawn, headed, headingTag, withMotifClass, twistySides } from '../root';
import type { Motif } from '../types';
import s from './well.module.css';

/** Params for {@link well}. */
export interface WellParams {
  /** `'box'` outlines the whole well; `'start'` draws only a rule down its leading edge. Defaults to `'box'`. */
  edge?: 'box' | 'start';
  /** A rule under the heading, between it and the body. */
  ruled?: boolean;
  /** Set the title as a params label — the label recipe's case, tracked `wide` or `wider` where the theme names none. */
  label?: 'wide' | 'wider';
}

/**
 * A sunken well holding its heading and body in a column: the look of a
 * settings form's groups. Its spacing and its title's size are read from
 * `--wzl-well-*` properties, so each surface that draws one sets its own.
 */
export function well(params: WellParams = {}): Motif<WellParams> {
  const { edge = 'box', ruled = false, label } = params;
  return {
    id: 'well',
    params,
    render({ heading: { title, titleId, inline, note, level, twisty, twistyAt, leading, actions }, body, root }) {
      const fold = twistySides({ twisty, twistyAt });
      const Heading = headingTag(level, 3);
      const row = headed({ title, titleId, inline, twisty, leading, actions });
      return (
        <div {...withMotifClass(root, s.well)} data-edge={edge} data-label={label}>
          {(row || drawn(note)) && (
            <div className={s.head} data-ruled={ruled ? '' : undefined}>
              {row && (
                <div className={s.row}>
                  {fold.start}
                  {leading}
                  {drawn(title) ? (
                    <Heading className={s.title} aria-labelledby={drawn(inline) ? titleId : undefined}>
                      <span id={titleId}>{title}</span>
                      {inline}
                    </Heading>
                  ) : (
                    inline
                  )}
                  {drawn(actions) && <span className={s.actions}>{actions}</span>}
                  {fold.end}
                </div>
              )}
              {drawn(note) && <div className={s.note}>{note}</div>}
            </div>
          )}
          {body}
        </div>
      );
    },
  };
}

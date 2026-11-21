import { drawn, headed, headingTag, twistySides } from '../root';
import type { Motif } from '../types';
import s from './divider.module.css';

/**
 * A small title trailed by a rule, with no box: `Subpanel`'s look, and the
 * motif a subpanel draws in when it is given none.
 */
export function divider(): Motif<Record<string, never>> {
  return {
    id: 'divider',
    params: {},
    render({ heading, body, root }) {
      const { title, titleId, inline, note, level, twisty, twistyAt, leading, actions } = heading;
      const fold = twistySides({ twisty, twistyAt });
      const Heading = headingTag(level, 4);
      return (
        <div {...root}>
          {/* The twisty is a sibling of the heading, so it stays out of its accessible name. */}
          {headed(heading) && (
            <div className={s.title}>
              {fold.start}
              {leading}
              {drawn(title) ? (
                <Heading className={s.heading} aria-labelledby={drawn(inline) ? titleId : undefined}>
                  <span id={titleId}>{title}</span>
                  {inline}
                </Heading>
              ) : (
                inline
              )}
              <hr />
              {drawn(actions) && <span className={s.actions}>{actions}</span>}
              {fold.end}
            </div>
          )}
          {note}
          {body}
        </div>
      );
    },
  };
}

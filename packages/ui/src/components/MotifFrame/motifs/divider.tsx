import { headingTag } from '../root';
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
    render({ heading: { title, titleId, inline, note, level, twisty, leading, actions }, body, root }) {
      const Heading = headingTag(level, 4);
      return (
        <div {...root}>
          {/* The twisty is a sibling of the heading, so it stays out of its accessible name. */}
          <div className={s.title}>
            {twisty}
            {leading}
            <Heading className={s.heading} aria-labelledby={inline === undefined ? undefined : titleId}>
              <span id={titleId}>{title}</span>
              {inline}
            </Heading>
            <hr />
            {actions === undefined ? null : <span className={s.actions}>{actions}</span>}
          </div>
          {note}
          {body}
        </div>
      );
    },
  };
}

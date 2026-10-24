import { withMotifClass } from '../root';
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
    render({ heading: { title, titleId, twisty, leading, actions }, body, root }) {
      return (
        <div {...withMotifClass(root, s.divider)}>
          {/* The twisty is a sibling of the heading, so it stays out of its accessible name. */}
          <div className={s.title}>
            {twisty}
            {leading}
            <h4 id={titleId}>{title}</h4>
            <hr />
            {actions === undefined ? null : <span className={s.actions}>{actions}</span>}
          </div>
          {body}
        </div>
      );
    },
  };
}

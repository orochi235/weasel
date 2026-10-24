import { withMotifClass } from '../root';
import type { Motif } from '../types';
import s from './titlebar.module.css';

/**
 * A solid title strip across the top, the way a desktop window is titled. The
 * strip is the edge color, or the tint where one is named; a theme repaints it
 * through `--wzl-titlebar-surface` and `--wzl-titlebar-fg`, centers the title
 * with `--wzl-titlebar-align`, and draws the frame's edge in relief with
 * `--wzl-bevel-raised`.
 */
export function titlebar(): Motif<Record<string, never>> {
  return {
    id: 'titlebar',
    params: {},
    render({ heading: { title, titleId, inline, note, twisty, leading, actions }, body, root }) {
      return (
        <div {...withMotifClass(root, s.titlebar)}>
          <div className={s.strip}>
            {twisty}
            {leading}
            <span className={s.mid}>
              <span id={titleId} className={s.label}>
                {title}
              </span>
              {inline}
            </span>
            {actions}
          </div>
          <div className={s.body}>
            {note}
            {body}
          </div>
        </div>
      );
    },
  };
}

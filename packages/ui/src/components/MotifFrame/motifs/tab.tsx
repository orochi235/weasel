import { withMotifClass } from '../root';
import type { Motif } from '../types';
import s from './tab.module.css';

/** Params for {@link tab}. */
export interface TabParams {
  /** Where the tab rises along the top edge. Defaults to `'start'`. */
  align?: 'start' | 'center' | 'end';
}

/** A folder tab rising from the top edge, holding the title, over an outlined box. */
export function tab(params: TabParams = {}): Motif<TabParams> {
  const { align = 'start' } = params;
  return {
    id: 'tab',
    params,
    render({ heading: { title, titleId, twisty, leading, actions }, body, root }) {
      return (
        <div {...withMotifClass(root, s.tab)}>
          <div className={s.tabRow} data-align={align}>
            <div className={s.label}>
              {twisty}
              {leading}
              <span id={titleId} className={s.text}>
                {title}
              </span>
              {actions}
            </div>
          </div>
          <div className={s.box}>{body}</div>
        </div>
      );
    },
  };
}

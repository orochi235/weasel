import { withMotifClass, twistySides } from '../root';
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
    render({ heading: { title, titleId, inline, note, twisty, twistyAt, leading, actions }, body, root }) {
      const fold = twistySides({ twisty, twistyAt });
      return (
        <div {...withMotifClass(root, s.tab)}>
          <div className={s.tabRow} data-align={align}>
            <div className={s.label}>
              {fold.start}
              {leading}
              <span id={titleId} className={s.text}>
                {title}
              </span>
              {inline}
              {actions}
              {fold.end}
            </div>
          </div>
          <div className={s.box}>
            {note}
            {body}
          </div>
        </div>
      );
    },
  };
}

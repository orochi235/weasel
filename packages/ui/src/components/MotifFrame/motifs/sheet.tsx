import { withMotifClass } from '../root';
import type { Motif } from '../types';
import s from './sheet.module.css';

/**
 * A raised sheet with its title along the top, at the display size: a
 * `PropertyPanel`'s look, and the motif a panel draws in when it is given none.
 * With no title, no actions and no twisty it draws no heading at all.
 */
export function sheet(): Motif<Record<string, never>> {
  return {
    id: 'sheet',
    params: {},
    render({ heading: { title, titleId, twisty, twistyAt, leading, actions }, body, root }) {
      const titled = title != null && (
        <h2 id={titleId} className={s.title}>
          {title}
        </h2>
      );
      const end = twistyAt === 'end';
      // Actions sit outside the heading, so they neither take its type nor join its accessible name.
      const head =
        actions == null && twisty == null && leading == null ? (
          titled
        ) : (
          <div className={s.head}>
            {!end && twisty}
            {leading}
            {titled}
            {actions != null && <div className={s.actions}>{actions}</div>}
            {end && twisty}
          </div>
        );
      return (
        <div {...withMotifClass(root, s.sheet)}>
          {head}
          {body}
        </div>
      );
    },
  };
}

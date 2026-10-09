import { withMotifClass } from '../root';
import type { Motif } from '../types';
import s from './rule.module.css';

/** The title centered between two rules, on a sunken fill: `PropertyGroup`'s look. */
export function rule(): Motif<Record<string, never>> {
  return {
    id: 'rule',
    params: {},
    render({ heading: { title, titleId, twisty, leading, actions }, body, root }) {
      // The heading is named by the title alone, not the twisty's label too.
      const titled = (
        <h3 className={s.title} aria-labelledby={twisty === undefined ? undefined : titleId}>
          <hr />
          <span className={s.mid}>
            {twisty === undefined ? null : <span className={s.twisty}>{twisty}</span>}
            <span id={titleId}>{title}</span>
          </span>
          <hr />
        </h3>
      );
      return (
        <div {...withMotifClass(root, s.rule)}>
          {leading === undefined && actions === undefined ? (
            titled
          ) : (
            <div className={s.headRow}>
              {leading === undefined ? null : <span className={s.leading}>{leading}</span>}
              {titled}
              {actions === undefined ? null : <span className={s.actions}>{actions}</span>}
            </div>
          )}
          {body}
        </div>
      );
    },
  };
}

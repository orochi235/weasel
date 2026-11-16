import type { ReactNode } from 'react';
import { headingTag, withMotifClass, twistySides } from '../root';
import type { Motif } from '../types';
import s from './rule.module.css';

const ruleTwisty = (twisty: ReactNode, end: boolean) =>
  twisty == null ? null : <span className={s.twisty} data-end={end ? '' : undefined}>{twisty}</span>;

/** The title centered between two rules, on a sunken fill: `PropertyGroup`'s look. */
export function rule(): Motif<Record<string, never>> {
  return {
    id: 'rule',
    params: {},
    render({ heading: { title, titleId, inline, note, level, twisty, twistyAt, leading, actions }, body, root }) {
      const fold = twistySides({ twisty, twistyAt });
      // The heading is named by the title alone, not the twisty's label too.
      const Heading = headingTag(level, 3);
      const titled = (
        <Heading className={s.title} aria-labelledby={twisty === undefined && inline === undefined ? undefined : titleId}>
          <hr />
          <span className={s.mid}>
            {ruleTwisty(fold.start, false)}
            <span id={titleId}>{title}</span>
            {inline}
            {ruleTwisty(fold.end, true)}
          </span>
          <hr />
        </Heading>
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
          {note}
          {body}
        </div>
      );
    },
  };
}

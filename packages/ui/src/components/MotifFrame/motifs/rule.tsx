import type { ReactNode } from 'react';
import { drawn, headed, headingTag, withMotifClass, twistySides } from '../root';
import type { Motif } from '../types';
import s from './rule.module.css';

const ruleTwisty = (twisty: ReactNode, end: boolean) =>
  drawn(twisty) && (
    <span className={s.twisty} data-end={end ? '' : undefined}>
      {twisty}
    </span>
  );

/** The title centered between two rules, on a sunken fill: `PropertyGroup`'s look. */
export function rule(): Motif<Record<string, never>> {
  return {
    id: 'rule',
    params: {},
    render({ heading, body, root }) {
      const { title, titleId, inline, note, level, twisty, twistyAt, leading, actions } = heading;
      const fold = twistySides({ twisty, twistyAt });
      // The heading is named by the title alone, not the twisty's label too.
      const Heading = drawn(title) ? headingTag(level, 3) : 'div';
      const named = drawn(title) && (drawn(twisty) || drawn(inline));
      const titled = headed(heading) && (
        <Heading className={s.title} aria-labelledby={named ? titleId : undefined}>
          <hr />
          <span className={s.mid}>
            {ruleTwisty(fold.start, false)}
            {drawn(title) && <span id={titleId}>{title}</span>}
            {inline}
            {ruleTwisty(fold.end, true)}
          </span>
          <hr />
        </Heading>
      );
      return (
        <div {...withMotifClass(root, s.rule)}>
          {!drawn(leading) && !drawn(actions) ? (
            titled
          ) : (
            <div className={s.headRow}>
              {drawn(leading) && <span className={s.leading}>{leading}</span>}
              {titled}
              {drawn(actions) && <span className={s.actions}>{actions}</span>}
            </div>
          )}
          {note}
          {body}
        </div>
      );
    },
  };
}

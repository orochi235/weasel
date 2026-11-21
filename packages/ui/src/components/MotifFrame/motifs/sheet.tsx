import { drawn, headed, headingTag, withMotifClass, twistySides } from '../root';
import type { Motif } from '../types';
import s from './sheet.module.css';

/**
 * A raised sheet with its title along the top, at the display size: a
 * `PropertyPanel`'s look, and the motif a panel draws in when it is given none.
 * With nothing to put in its heading it draws no heading at all.
 */
export function sheet(): Motif<Record<string, never>> {
  return {
    id: 'sheet',
    params: {},
    render({ heading, body, root }) {
      const { title, titleId, inline, note, level, twisty, twistyAt, leading, actions } = heading;
      const Heading = headingTag(level, 2);
      const titled = drawn(title) ? (
        <Heading className={s.title} aria-labelledby={drawn(inline) ? titleId : undefined}>
          <span id={titleId}>{title}</span>
          {inline}
        </Heading>
      ) : (
        inline
      );
      const fold = twistySides({ twisty, twistyAt });
      // Actions sit outside the heading, so they neither take its type nor join its accessible name.
      const lone = drawn(title) && !drawn(actions) && !drawn(twisty) && !drawn(leading);
      const head = lone
        ? titled
        : headed(heading) && (
            <div className={s.head}>
              {fold.start}
              {leading}
              {titled}
              {drawn(actions) && <div className={s.actions}>{actions}</div>}
              {fold.end}
            </div>
          );
      return (
        <div {...withMotifClass(root, s.sheet)}>
          {head}
          {note}
          {body}
        </div>
      );
    },
  };
}

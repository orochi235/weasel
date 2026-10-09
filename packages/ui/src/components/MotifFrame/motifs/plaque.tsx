import type { CSSProperties } from 'react';
import { withMotifClass } from '../root';
import type { Motif } from '../types';
import s from './plaque.module.css';

/** Params for {@link plaque}. */
export interface PlaqueParams {
  /** How much of the tone fills the frame, in percent. Defaults to 100. */
  mix?: number;
}

/**
 * The tone fills the whole frame. The title, the text and the controls on it
 * are redrawn in black or white, whichever the fill's lightness calls for.
 */
export function plaque(params: PlaqueParams = {}): Motif<PlaqueParams> {
  const { mix } = params;
  return {
    id: 'plaque',
    params,
    render({ heading: { title, titleId, twisty, leading, actions }, body, root }) {
      const rooted = withMotifClass(root, s.plaque);
      const style =
        mix === undefined ? rooted.style : ({ ...rooted.style, '--wzl-plaque-mix': `${mix}%` } as CSSProperties);
      return (
        <div {...rooted} style={style}>
          <div className={s.content}>
            <div className={s.head}>
              {twisty}
              {leading}
              <span id={titleId} className={s.label}>
                {title}
              </span>
              {actions}
            </div>
            {body}
          </div>
        </div>
      );
    },
  };
}

import { withMotifClass } from '../root';
import type { Motif } from '../types';
import s from './stereo.module.css';

/** Params for {@link stereo}. */
export interface StereoParams {
  /** The edge the label bar runs along. Defaults to `'left'`. */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /**
   * Where the title sits along the bar, in its reading direction: `start` is
   * the bottom of a left bar and the top of a right one. Defaults to `'center'`.
   */
  labelAlign?: 'start' | 'center' | 'end';
  /** Swaps the bar's fill and title colors, and the border takes the title's. Defaults to false. */
  invert?: boolean;
}

/**
 * A label bar along one edge, in the tint, the way the back of an A/V
 * receiver labels a group of jacks. The title is never upside-down and is
 * read from inside the frame: a left bar reads bottom to top, a right bar top
 * to bottom, and top and bottom bars read across.
 */
export function stereo(params: StereoParams = {}): Motif<StereoParams> {
  const { side = 'left', labelAlign = 'center', invert = false } = params;
  return {
    id: 'stereo',
    params,
    render({ heading: { title, titleId, inline, note, twisty, leading, actions }, body, root }) {
      return (
        <div {...withMotifClass(root, s.stereo)} data-side={side} data-invert={invert || undefined}>
          <div className={s.bar} data-align={labelAlign}>
            {twisty}
            {leading}
            <span id={titleId} className={s.label}>
              {title}
            </span>
            {inline}
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

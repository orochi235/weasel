import type { ReactNode } from 'react';
import s from './storyLayouts.module.css';

/**
 * Side-by-side comparison used by row stories to show block + inline layouts
 * at the same time. Not a stories file — name has no .stories. suffix so
 * The story glob skips it.
 */
export function SideBySide({ block, inline }: { block: ReactNode; inline: ReactNode }) {
  return (
    <div className={s.sideBySide}>
      <div>
        <div className={s.caption}>Block</div>
        {block}
      </div>
      <div>
        <div className={s.caption}>Inline</div>
        {inline}
      </div>
    </div>
  );
}

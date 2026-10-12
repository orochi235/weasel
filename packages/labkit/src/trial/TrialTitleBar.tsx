import type { ReactNode } from 'react';
import { TileGrip } from '../lab/TileGrip';

/** Props for `<TrialTitleBar>`. */
export interface TrialTitleBarProps {
  title: string;
  /** Drawn in place of `title`'s text. */
  titleContent?: ReactNode;
  /** Rendered at the leading edge, before the title. */
  lead?: ReactNode;
  children?: ReactNode;
}

/** A trial's title bar. When the workspace allows reordering the whole bar is
 *  the drag surface — there is no separate grip, because a window's title bar
 *  is already the thing you expect to drag. */
export function TrialTitleBar({ title, titleContent, lead, children }: TrialTitleBarProps) {
  return (
    <TileGrip className="lk-trial__titlebar">
      {lead}
      <span className="lk-trial__title">{titleContent ?? title}</span>
      {children}
    </TileGrip>
  );
}

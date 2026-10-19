import { type ReactNode, useContext } from 'react';
import { TileGrip } from '../lab/TileGrip';
import { CameraMissingContext } from './useOrbitView';

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
  const noCamera = useContext(CameraMissingContext);
  return (
    <TileGrip className="lk-trial__titlebar">
      {lead}
      <span className="lk-trial__title">{titleContent ?? title}</span>
      {noCamera ? (
        <span
          className="lk-trial__no-camera"
          title={`Draws a 3D view (${noCamera}) with no camera: declare the instrument's \`orbit\`. See the console.`}
        >
          no camera
        </span>
      ) : null}
      {children}
    </TileGrip>
  );
}

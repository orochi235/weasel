import type { ReactNode } from 'react';
import { well } from '../MotifFrame/motifs/well';
import { HiddenBadge } from './hidden';

/** A settings form's own looks for its framed groups, drawn unless an app's `<DefaultMotif>` names another. */
export const FORM_FRAMES = {
  /** A top-level group of the columns layout: a well, its heading ruled off. */
  column: well({ ruled: true }),
  /** A group inside one: a rule down its leading edge. */
  nested: well({ edge: 'start' }),
  /** An `as: 'panel'` group anywhere else: a plain well. */
  box: well(),
} as const;

/** What a framed group's heading holds after its name: the hidden mark, then the control of a leaf marked `heading`. */
export function headingInline(marked: boolean, control: ReactNode): ReactNode {
  return marked || control != null ? (
    <>
      {marked && <HiddenBadge />}
      {control}
    </>
  ) : undefined;
}

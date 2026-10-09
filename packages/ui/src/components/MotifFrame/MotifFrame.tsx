import { useId } from 'react';
import { useStance } from '../stance';
import s from './MotifFrame.module.css';
import { rule } from './motifs/rule';
import type { MotifFrameProps, RootProps } from './types';

const DEFAULT_MOTIF = rule();

/**
 * A titled frame around anything, drawn in a motif: `rule` (a title between
 * two rules, the default), `stereo` (a label bar along one edge), `notch` (the
 * title cut into the border), `tab` or `plaque` (the tone fills the frame).
 *
 * Every motif colors itself from the same `stance` and `tone`, so a theme that
 * recolors one recolors all of them. The root is a `group` named by its title.
 */
export function MotifFrame({
  title,
  motif,
  leading,
  actions,
  twisty,
  hidden,
  children,
  className,
  stance,
  tone,
}: MotifFrameProps) {
  const titleId = useId();
  const stanced = useStance({ stance, tone });
  if (hidden) return null;
  const chosen = motif ?? DEFAULT_MOTIF;
  const root: RootProps = {
    ...stanced,
    className: [s.frame, className].filter(Boolean).join(' '),
    role: 'group',
    'aria-labelledby': titleId,
    'data-motif': chosen.id,
  };
  return chosen.render({ heading: { title, titleId, twisty, leading, actions }, body: children, root });
}
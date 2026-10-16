import { createContext, type ReactNode, useContext, useId } from 'react';
import { useStance } from '../stance';
import s from './MotifFrame.module.css';
import { rule } from './motifs/rule';
import type { Motif, MotifFrameProps, RootProps } from './types';

const MotifContext = createContext<Motif>(rule());

/**
 * Names the motif every `<MotifFrame>` below draws in when it is given none,
 * `PropertyGroup`s included: how an app sets a theme's titled groups in that
 * theme's frame, as `titlebar()` under a desktop theme.
 */
export function DefaultMotif({ motif, children }: { motif: Motif; children: ReactNode }) {
  return <MotifContext.Provider value={motif}>{children}</MotifContext.Provider>;
}

/**
 * A titled frame around anything, drawn in a motif: `rule` (a title between
 * two rules, the default), `stereo` (a label bar along one edge), `notch` (the
 * title cut into the border), `tab`, `plaque` (the tone fills the frame) or
 * `titlebar` (a strip across the top). A `<DefaultMotif>` above changes the default.
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
  onContextMenu,
}: MotifFrameProps) {
  const titleId = useId();
  const stanced = useStance({ stance, tone });
  const inherited = useContext(MotifContext);
  if (hidden) return null;
  const chosen = motif ?? inherited;
  const root: RootProps = {
    ...stanced,
    className: [s.frame, className].filter(Boolean).join(' '),
    role: 'group',
    'aria-labelledby': titleId,
    'data-motif': chosen.id,
    ...(onContextMenu ? { onContextMenu } : {}),
  };
  return chosen.render({ heading: { title, titleId, twisty, leading, actions }, body: children, root });
}
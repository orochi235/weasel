import { createContext, type ReactNode, useContext, useId } from 'react';
import { useStance } from '../stance';
import s from './MotifFrame.module.css';
import { divider } from './motifs/divider';
import { rule } from './motifs/rule';
import type { FrameKind, Motif, MotifFrameProps, RootProps } from './types';

const MotifContext = createContext<Readonly<Record<FrameKind, Motif>>>({ group: rule(), subpanel: divider() });

/** Props for `<DefaultMotif>`: the motif for each kind of frame, where it changes. */
export type DefaultMotifProps = Partial<Record<FrameKind, Motif>> & { children: ReactNode };

/**
 * Names the motif each kind of `<MotifFrame>` below draws in when it is given
 * none — `group` for `PropertyGroup`s and plain frames, `subpanel` for
 * `Subpanel`s. A kind left out keeps the motif from further up. It is how an
 * app sets a theme's titled groups in that theme's frame, as `titlebar()`
 * under a desktop theme, without turning every subpanel into a window too.
 */
export function DefaultMotif({ children, ...kinds }: DefaultMotifProps) {
  const outer = useContext(MotifContext);
  return <MotifContext.Provider value={{ ...outer, ...kinds }}>{children}</MotifContext.Provider>;
}

/**
 * A titled frame around anything, drawn in a motif: `rule` (a title between
 * two rules, the default), `stereo` (a label bar along one edge), `notch` (the
 * title cut into the border), `tab`, `plaque` (the tone fills the frame) or
 * `titlebar` (a strip across the top), or `divider` (a title and a rule, a
 * subpanel's look). A `<DefaultMotif>` above changes the default for each `kind`.
 *
 * Every motif colors itself from the same `stance` and `tone`, so a theme that
 * recolors one recolors all of them. The root is a `group` named by its title.
 */
export function MotifFrame({
  title,
  motif,
  kind = 'group',
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
  const chosen = motif ?? inherited[kind];
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
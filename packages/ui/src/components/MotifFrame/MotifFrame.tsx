import { createContext, type ReactNode, useContext, useId } from 'react';
import { useAppearance } from '../appearance';
import s from './MotifFrame.module.css';
import { divider } from './motifs/divider';
import { rule } from './motifs/rule';
import { sheet } from './motifs/sheet';
import type { FrameKind, Motif, MotifFrameProps, RootProps } from './types';

const MotifContext = createContext<Readonly<Record<FrameKind, Motif>>>({
  panel: sheet(),
  group: rule(),
  subpanel: divider(),
});

/** Props for `<DefaultMotif>`: the motif for each kind of frame, where it changes. */
export type DefaultMotifProps = Partial<Record<FrameKind, Motif>> & { children: ReactNode };

/**
 * Names the motif each kind of `<MotifFrame>` below draws in when it is given
 * none — `panel` for `PropertyPanel`s, `group` for `PropertyGroup`s and plain
 * frames, `subpanel` for `Subpanel`s. A kind left out keeps the motif from
 * further up. It is how an app sets a theme's frames in that theme's look, as
 * `titlebar()` for groups under a desktop theme, without turning every
 * subpanel into a window too.
 *
 * A kind decides a frame's colors and title type — a panel reads the
 * `--wzl-panel-*` slots in any motif — and the motif only its geometry.
 */
export function DefaultMotif({ children, ...kinds }: DefaultMotifProps) {
  const outer = useContext(MotifContext);
  return <MotifContext.Provider value={{ ...outer, ...kinds }}>{children}</MotifContext.Provider>;
}

/**
 * A titled frame around anything, drawn in a motif: `rule` (a title between
 * two rules, the default), `stereo` (a label bar along one edge), `notch` (the
 * title cut into the border), `tab`, `plaque` (the tint fills the frame) or
 * `titlebar` (a strip across the top), `sheet` (a raised sheet titled along the
 * top, a panel's look) or `divider` (a title and a rule, a subpanel's look). A `<DefaultMotif>` above changes the default for each `kind`.
 *
 * Every motif colors itself from the same appearance props, so a theme that
 * recolors one recolors all of them. The root is a `group` named by its title.
 */
export function MotifFrame({
  title,
  motif,
  kind = 'group',
  leading,
  actions,
  twisty,
  twistyAt,
  attrs,
  hidden,
  children,
  className,
  stance,
  grade,
  emphasis,
  tint,
  onContextMenu,
}: MotifFrameProps) {
  const titleId = useId();
  const appearance = useAppearance({ stance, grade, emphasis, tint });
  const inherited = useContext(MotifContext);
  if (hidden) return null;
  const chosen = motif ?? inherited[kind];
  const root: RootProps = {
    ...attrs,
    ...appearance,
    className: [s.frame, className].filter(Boolean).join(' '),
    ...(title == null ? {} : { role: 'group', 'aria-labelledby': titleId }),
    'data-motif': chosen.id,
    ...(onContextMenu ? { onContextMenu } : {}),
  };
  return chosen.render({ heading: { title, titleId, twisty, twistyAt, leading, actions }, body: children, root });
}
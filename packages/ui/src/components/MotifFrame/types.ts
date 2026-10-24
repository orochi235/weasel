import type { CSSProperties, MouseEventHandler, ReactNode } from 'react';
import type { AppearanceProps } from '../appearance';

/** The parts of a frame's heading, which a motif places as it sees fit. */
export interface HeadingParts {
  /** Absent for an untitled frame: an untitled panel draws no heading. */
  title?: ReactNode;
  /** The id the title's own element carries; the frame is named by it. */
  titleId: string;
  /** A control that folds the body away, from a caller that folds: `PropertyGroup`. */
  twisty?: ReactNode;
  /** Which end of the heading the twisty sits at, where the motif places it in a row. Defaults to `'start'`. */
  twistyAt?: 'start' | 'end';
  /** Before the title: a drag handle, an ordinal. */
  leading?: ReactNode;
  /** After the title: a summary of the frame's value, a remove button. */
  actions?: ReactNode;
}

/** `data-*` attributes a caller puts on the frame's root, for its own stylesheet to read. */
export type FrameAttrs = { readonly [attr: `data-${string}`]: string | undefined };

/** The attributes a motif spreads on the element it renders as the frame's root. */
export interface RootProps extends FrameAttrs {
  className: string;
  /** A titled frame is a group named by its title; an untitled one is neither. */
  role?: 'group';
  'aria-labelledby'?: string;
  'data-motif': string;
  'data-stance'?: string;
  'data-grade'?: string;
  'data-emphasis'?: string;
  'data-tint'?: string;
  onContextMenu?: MouseEventHandler;
  style?: CSSProperties;
}

/** Everything a motif draws a frame from. */
export interface FrameParts {
  heading: HeadingParts;
  body: ReactNode;
  root: RootProps;
}

/**
 * How a titled frame draws its title and its edge. Made by a factory —
 * `stereo({ side: 'left' })` — and handed to `<MotifFrame motif>`. The motif
 * renders the frame's root element itself, so it chooses the element as well
 * as the layout: `notch` is a `<fieldset>`.
 */
export interface Motif<P = unknown> {
  readonly id: string;
  /** What the factory was given, for a reader; `render` already closes over it. */
  readonly params: P;
  render(frame: FrameParts): ReactNode;
}

/** What a frame is to the frames around it, which picks its motif under `<DefaultMotif>`. */
export type FrameKind = 'panel' | 'group' | 'subpanel';

/** Props for `<MotifFrame>`. */
export interface MotifFrameProps extends AppearanceProps {
  /** The frame's title, which names it. An untitled frame is not a named group. */
  title?: ReactNode;
  /** How the frame draws its title and edge. Defaults to the `<DefaultMotif>` for its `kind`: `sheet()` for a panel, `rule()` for a group, `divider()` for a subpanel. */
  motif?: Motif;
  /** Which default motif the frame takes when given none. Defaults to `'group'`. */
  kind?: FrameKind;
  /** Before the title: a drag handle, an ordinal. */
  leading?: ReactNode;
  /** After the title: a summary of the frame's value, a remove button. */
  actions?: ReactNode;
  /** A control that folds the body away. The frame places it; the caller owns what it folds. */
  twisty?: ReactNode;
  /** Which end of the heading the twisty sits at. Defaults to `'start'`. */
  twistyAt?: 'start' | 'end';
  /** `data-*` attributes for the root, read by the caller's own stylesheet. */
  attrs?: FrameAttrs;
  /** When true the frame renders nothing. */
  hidden?: boolean;
  children?: ReactNode;
  className?: string;
  /** A right-click anywhere on the frame. */
  onContextMenu?: MouseEventHandler;
}

import type { CSSProperties, MouseEventHandler, ReactNode } from 'react';
import type { AppearanceProps } from '../appearance';

/** The parts of a frame's heading, which a motif places as it sees fit. */
export interface HeadingParts {
  /** Absent for an untitled frame: an untitled panel draws no heading. */
  title?: ReactNode;
  /** The id the title's own element carries; the frame is named by it. */
  titleId: string;
  /** Drawn inside the heading after the title, and kept out of the frame's name: a control the title row owns. */
  inline?: ReactNode;
  /** Help text for the whole frame, drawn under its heading. */
  note?: ReactNode;
  /** The outline level of the heading, for a motif that draws a heading element. Each motif has its own default. */
  level?: HeadingLevel;
  /** A control that folds the body away, from a caller that folds: `PropertyGroup`. */
  twisty?: ReactNode;
  /** Which end of the heading the twisty sits at, where the motif places it in a row. Defaults to `'start'`. */
  twistyAt?: 'start' | 'end';
  /** Before the title: a drag handle, an ordinal. */
  leading?: ReactNode;
  /** After the title: a summary of the frame's value, a remove button. */
  actions?: ReactNode;
}

/** A heading's outline level, `h1` to `h6`. */
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/** `data-*` attributes a caller puts on the frame's root, for its own stylesheet to read. */
export type FrameAttrs = { readonly [attr: `data-${string}`]: string | undefined };

/** The attributes a motif spreads on the element it renders as the frame's root. */
export interface RootProps extends FrameAttrs {
  className: string;
  /** A titled frame is a group, or a region where it asks to be a landmark, named by its title; an untitled one is neither. */
  role?: 'group' | 'region';
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
  /**
   * The motif drawn when neither `motif` nor a `<DefaultMotif>` above names one for the kind: a
   * component's own look, which an app's explicit default still overrides. The kind's built-in
   * motif is drawn when this is absent too.
   */
  fallback?: Motif;
  /** `'region'` makes a titled frame a landmark rather than a group. Defaults to `'group'`. */
  role?: 'group' | 'region';
  /** Drawn inside the heading after the title, and kept out of the frame's name. */
  inline?: ReactNode;
  /** Help text for the whole frame, drawn under its heading. */
  note?: ReactNode;
  /** The outline level of the heading, where the motif draws a heading element. */
  level?: HeadingLevel;
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
  /** What the frame holds takes no input: its title dims as a disabled row's label does. Its `inline`,
   *  `leading` and `actions` do not, since one of them may be the switch that turns it back on. */
  disabled?: boolean;
  children?: ReactNode;
  className?: string;
  /** A right-click anywhere on the frame. */
  onContextMenu?: MouseEventHandler;
}

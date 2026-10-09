import type { CSSProperties, ReactNode } from 'react';
import type { StanceProps } from '../stance';

/** The parts of a frame's heading, which a motif places as it sees fit. */
export interface HeadingParts {
  title: ReactNode;
  /** The id the title's own element carries; the frame is named by it. */
  titleId: string;
  /** A control that folds the body away, from a caller that folds: `PropertyGroup`. */
  twisty?: ReactNode;
  /** Before the title: a drag handle, an ordinal. */
  leading?: ReactNode;
  /** After the title: a summary of the frame's value, a remove button. */
  actions?: ReactNode;
}

/** The attributes a motif spreads on the element it renders as the frame's root. */
export interface RootProps {
  className: string;
  role: 'group';
  'aria-labelledby': string;
  'data-motif': string;
  'data-stance'?: string;
  'data-tone'?: string;
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

/** Props for `<MotifFrame>`. */
export interface MotifFrameProps extends StanceProps {
  title: ReactNode;
  /** How the frame draws its title and edge. Defaults to `rule()`. */
  motif?: Motif;
  /** Before the title: a drag handle, an ordinal. */
  leading?: ReactNode;
  /** After the title: a summary of the frame's value, a remove button. */
  actions?: ReactNode;
  /** A control that folds the body away. The frame places it; the caller owns what it folds. */
  twisty?: ReactNode;
  /** When true the frame renders nothing. */
  hidden?: boolean;
  children?: ReactNode;
  className?: string;
}

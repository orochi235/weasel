import type { KeyboardEvent, MouseEvent, PointerEvent, ReactElement, ReactNode } from 'react';
import type { ControlAccess } from '@weasel-js/ui-logic';
import type { HoldProps } from '../Disabled';
import { useControlHold, type HeldAttrs } from '../Disabled/controlHold';

/** What a held thumb takes beyond its usual attributes. */
export interface ThumbHoldAttrs extends HeldAttrs {
  tabIndex: 0 | -1;
}

/** What {@link useSliderHold} gives a slider. */
export interface SliderHold {
  access: ControlAccess;
  /** Whether every drag, key step, and press is refused: disabled or read-only. */
  refuses: boolean;
  /** Spread onto each thumb. A thumb held with no reason leaves the tab order. */
  thumb: ThumbHoldAttrs;
  /** On the root, for the stylesheet. */
  held: 'disabled' | 'readOnly' | undefined;
  /** Follows the slider with its reason's description and tooltip. */
  wrap(node: ReactNode): ReactElement;
  /** The slider's presses, or, held, presses that move, add, and remove nothing. */
  pointer(live: SliderPresses): SliderPresses;
  /** The thumbs' key handlers, or, held, ones that step nothing. */
  keys(live: (index: number) => (e: KeyboardEvent) => void): (index: number) => (e: KeyboardEvent) => void;
}

/** The press handlers a slider hands its thumbs and track. */
export interface SliderPresses {
  onThumbPointerDown: (index: number) => (e: PointerEvent) => void;
  onThumbContextMenu: (index: number) => (e: MouseEvent) => void;
  onTrackPointerDown: (e: PointerEvent<Element>) => void;
}

const ignore = (): void => {};
const REFUSED: SliderPresses = { onThumbPointerDown: () => ignore, onThumbContextMenu: () => ignore, onTrackPointerDown: ignore };

/** A slider's hold, from its own props and the scopes around it. */
export function useSliderHold(own: HoldProps): SliderHold {
  const hold = useControlHold(own);
  return {
    access: hold.access,
    refuses: hold.refuses,
    thumb: { tabIndex: hold.tabIndex(0), ...hold.attrs },
    held: hold.held,
    wrap: hold.wrap,
    pointer: (live) => (hold.refuses ? REFUSED : live),
    keys: (live) => (hold.refuses ? () => ignore : live),
  };
}

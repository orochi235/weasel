import type { KeyboardEvent, MouseEvent, PointerEvent, ReactElement, ReactNode } from 'react';
import type { ControlAccess } from '@weasel-js/ui-logic';
import { useControlAccess, type HoldProps } from '../Disabled';
import { describedBy, useHoldReason } from '../Disabled/HoldReason';

/** What a held thumb takes beyond its usual attributes. */
export interface ThumbHoldAttrs {
  tabIndex: 0 | -1;
  'aria-disabled'?: true;
  'aria-readonly'?: true;
  'aria-describedby'?: string;
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
  const access = useControlAccess(own);
  const reason = useHoldReason(access.reason);
  const refuses = access.state !== 'enabled';
  const thumb: ThumbHoldAttrs = {
    tabIndex: refuses && !access.reachable ? -1 : 0,
    ...(access.state === 'disabled' ? { 'aria-disabled': true } : {}),
    ...(access.state === 'readOnly' ? { 'aria-readonly': true } : {}),
  };
  const describe = describedBy(reason.describedBy);
  if (describe) thumb['aria-describedby'] = describe;
  return {
    access,
    refuses,
    thumb,
    held: refuses ? (access.state as 'disabled' | 'readOnly') : undefined,
    wrap: reason.wrap,
    pointer: (live) => (refuses ? REFUSED : live),
    keys: (live) => (refuses ? () => ignore : live),
  };
}

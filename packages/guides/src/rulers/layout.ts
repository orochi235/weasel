import { viewWorldToScreen, type View } from '@weasel-js/core';
import type { UnitValue } from '@weasel-js/quantity';
import type { Guide } from '../guides/types';
import type { RulerFrame } from './reading';
import { rulerTicks, type RulerTicks } from './ticks';

type Point = { x: number; y: number };

/** What the rulers show now: the view and canvas they run along, the pointer,
 *  the frame under it, and the guide a drag off a ruler is placing. */
export interface RulersState {
  /** The canvas's view, or `null` before it first paints. */
  view: View | null;
  /** The canvas's size in CSS px. */
  width: number;
  height: number;
  /** The pointer in world, or `null` while it is off the canvas. */
  pointer: Point | null;
  /** The frame the labels read in. */
  frame: RulerFrame;
  /** The guide a drag off a ruler would place now, or `null`. */
  draft: Guide | null;
}

/** How {@link rulersLayout} spaces the ticks: what `rulerTicks` takes. */
export interface RulersSpacing {
  majorPx?: number;
  minorPx?: number;
  lengths?: readonly UnitValue[];
}

/** Both rulers laid out: the horizontal one along the top, the vertical along
 *  the left, each the canvas's full length with the corner box over the start. */
export interface RulersLayout {
  top: RulerTicks;
  left: RulerTicks;
  /** The pointer on screen, in CSS px from the canvas's top-left; `null` off it. */
  pointer: Point | null;
}

/** Lay out both rulers for `state`, or `null` before the canvas has a view. */
export function rulersLayout(state: RulersState, spacing: RulersSpacing = {}): RulersLayout | null {
  const { view, frame } = state;
  if (view === null) return null;
  const common = { scopes: frame.scopes, ...spacing };
  return {
    top: rulerTicks({ ...common, pxPerUnit: view.scale.x, start: view.x, length: state.width, origin: frame.origin.x }),
    left: rulerTicks({ ...common, pxPerUnit: view.scale.y, start: view.y, length: state.height, origin: frame.origin.y }),
    pointer: state.pointer === null ? null : viewWorldToScreen(view, state.pointer),
  };
}

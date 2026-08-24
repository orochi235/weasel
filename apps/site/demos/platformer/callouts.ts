// apps/site/demos/platformer/callouts.ts
import type { Dims, View } from '@weasel-js/core';
import { worldToScreen } from './camera';
import type { Vec2 } from './level';

export type CalloutAnchor = { kind: 'world'; at: Vec2 } | { kind: 'screen' };

export interface Callout {
  text: string;
  anchor: CalloutAnchor;
  /** Seconds, on the same clock as the `now` passed to `stepCallouts`. */
  bornAt: number;
  /** Seconds the callout lives before it expires. */
  ttl: number;
}

export const pushCallout = (list: Callout[], c: Callout): Callout[] => [...list, c];

/** Drops every callout whose `ttl` has elapsed as of `now`. */
export const stepCallouts = (list: Callout[], now: number): Callout[] =>
  list.filter((c) => now - c.bornAt < c.ttl);

/** Where a callout draws on screen — a world anchor projects through the
 *  camera, a screen anchor sits at the canvas center regardless of it. */
export function calloutScreenPos(c: Callout, view: View, dims: Dims): { x: number; y: number } {
  return c.anchor.kind === 'world'
    ? worldToScreen(view, c.anchor.at.x, c.anchor.at.y)
    : { x: dims.width / 2, y: dims.height / 2 };
}

/** 0 at birth, 1 at expiry. Callers use this to fade and float the callout;
 *  a caller holding an already-expired callout gets 1, not an out-of-range value. */
export function calloutAge(c: Callout, now: number): number {
  return Math.min(Math.max((now - c.bornAt) / c.ttl, 0), 1);
}

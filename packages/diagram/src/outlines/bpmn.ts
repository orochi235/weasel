/**
 * BPMN's own figures. Events and gateways are small and carry their label
 * underneath, as BPMN draws them; a subprocess is a task with a boxed plus
 * at its foot.
 */
import { PathBuilder } from '@weasel-js/core/math';
import { FIGURE_OUTLINES, figureOver } from './figures';
import { FLOWCHART_OUTLINES } from './flowchart';
import { outlineFromD } from './fromD';
import type { Bounds, OutlineDef } from './types';

/** The label strip under an event or a gateway, in px at the default size. */
const STRIP = 32;
const EVENT = 40;
const GATEWAY = 50;

/** What an event stencil places on a click: a 40px circle over its label. */
export const EVENT_SIZE = { width: 90, height: EVENT + STRIP };
/** What a gateway stencil places on a click: a 50px diamond over its label. */
export const GATEWAY_SIZE = { width: 100, height: GATEWAY + STRIP };

const event = figureOver(FLOWCHART_OUTLINES.ellipse, 1, EVENT / (EVENT + STRIP));
const intermediateEvent = figureOver(FIGURE_OUTLINES.doubleEllipse, 1, EVENT / (EVENT + STRIP));

const DIAMOND = 'M0.5 0L1 0.5L0.5 1L0 0.5Z';
const gateway = (marker: string): OutlineDef =>
  figureOver(outlineFromD(DIAMOND, { detail: marker }), 1, GATEWAY / (GATEWAY + STRIP));

const ring = (r: number): string => `M${0.5 + r} 0.5A${r} ${r} 0 1 1 ${0.5 - r} 0.5A${r} ${r} 0 1 1 ${0.5 + r} 0.5`;

/** A regular pentagon, point up, around the center. */
const PENTAGON = (() => {
  const r = 0.13;
  const pts = [0, 1, 2, 3, 4].map((k) => {
    const t = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
    return `${(0.5 + r * Math.cos(t)).toFixed(4)} ${(0.5 + r * Math.sin(t)).toFixed(4)}`;
  });
  return `M${pts.join('L')}Z`;
})();

const exclusiveGateway = gateway('M0.37 0.37L0.63 0.63M0.63 0.37L0.37 0.63');
const parallelGateway = gateway('M0.5 0.3V0.7M0.3 0.5H0.7');
const inclusiveGateway = gateway(ring(0.2));
const eventGateway = gateway(ring(0.22) + PENTAGON);

/** The boxed plus: its side and the gap under it, in px, shrinking with a small box. */
const MARKER = 14;
const MARKER_GAP = 4;
const markerOf = (w: number, h: number): number => Math.min(MARKER, w / 4, h / 3);

const roundRect = FIGURE_OUTLINES.roundRect;
const subprocess: OutlineDef = {
  path: roundRect.path,
  detail: ({ x, y, width: w, height: h }) => {
    const m = markerOf(w, h);
    const left = x + (w - m) / 2;
    const top = y + h - MARKER_GAP - m;
    const arm = m * 0.25;
    return new PathBuilder()
      .moveTo(left, top).lineTo(left + m, top).lineTo(left + m, top + m).lineTo(left, top + m).close()
      .moveTo(left + m / 2, top + arm).lineTo(left + m / 2, top + m - arm)
      .moveTo(left + arm, top + m / 2).lineTo(left + m - arm, top + m / 2)
      .build();
  },
  content: (b: Bounds) => {
    const c = roundRect.content!(b);
    const foot = b.y + b.height - MARKER_GAP - markerOf(b.width, b.height);
    return { ...c, height: Math.max(Math.min(c.y + c.height, foot) - c.y, 0) };
  },
  boxForContent: (c) => {
    const box = roundRect.boxForContent!(c);
    return { width: box.width, height: box.height + MARKER + MARKER_GAP };
  },
};

export const BPMN_OUTLINES = {
  event, intermediateEvent, exclusiveGateway, parallelGateway, inclusiveGateway, eventGateway, subprocess,
};

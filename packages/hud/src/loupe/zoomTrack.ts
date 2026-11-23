import { textCommandFromRuns } from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';
import { ellipsePath, ellipseShape, lineShape, polylineFromPoints, type TrackShape } from '@weasel-js/geom';
import { nearestStopIndex } from '@weasel-js/loupe';
import { solidFill } from '@weasel-js/paint';
import type { HudDrawCtx, HudPointerEvent, Widget, WidgetBounds } from '../widget';
import type { WindowWidget } from '../widgets/window/window';
import { lensTone } from './lensTone';
import { textWidth } from '../menu/textWidth';

/** The zoom runs across the bottom of a round lens, through 6 o'clock and clear of 3 and 9, as labkit's lens does. */
const START = 252;
const END = 108;
/** Px from the interior's edge to the track: room for the thumb inside the rim. */
const INSET = 18;
/** Px from a rect interior's sides to its straight track's ends. */
const SIDE_INSET = 20;
/** Px either side of the track a press still lands on it. */
const REACH = 9;
const THUMB_R = 6;
const LABEL_PX = 9;
/** Px from the track to a stop's label, toward the lens's middle. */
const LABEL_GAP = 11;
const SAMPLES = 48;
const NOWHERE: WidgetBounds = { x: 0, y: 0, width: 0, height: 0 };

/** The track a lens's zoom lies along: an arc inside a round interior, a line across the bottom of a rect one. */
export function zoomTrackIn(r: WidgetBounds, round: boolean): TrackShape {
  if (round) {
    const radius = Math.max(0, r.width / 2 - INSET);
    return ellipseShape({
      center: { x: r.x + r.width / 2, y: r.y + r.height / 2 },
      radiusX: radius, radiusY: radius, start: START, end: END, direction: 'ccw',
    });
  }
  const y = r.y + r.height - INSET;
  return lineShape({ x: r.x + SIDE_INSET, y }, { x: Math.max(r.x + SIDE_INSET, r.x + r.width - SIDE_INSET), y });
}

/** What the zoom reads of its lens, and tells it. */
export interface ZoomTrackHost {
  win: WindowWidget;
  round: boolean;
  /** The factors it stops at, ascending, spaced evenly along it. */
  stops: readonly number[];
  factor(): number;
  setFactor(factor: number): void;
}

/** A slider along a lens's rim that stops at `stops`: a press or drag on it sets the lens's factor to the stop
 *  nearest the pointer. Only the band takes presses, so the rest of the lens still moves or picks. */
export function createZoomTrack(id: string, host: ZoomTrackHost): Widget {
  const { win, stops } = host;
  const track = (): TrackShape => zoomTrackIn(win.contentRect, host.round);
  const fractionOf = (i: number): number => (stops.length > 1 ? i / (stops.length - 1) : 0);
  const stopAt = (x: number, y: number): number => {
    const near = track().nearest({ x, y });
    return near.distance <= REACH ? Math.round(near.f * (stops.length - 1)) : -1;
  };
  let dragging = false;
  const setFromPointer = (x: number, y: number) => {
    const near = track().nearest({ x, y });
    host.setFactor(stops[Math.round(near.f * (stops.length - 1))]!);
  };

  const box = (): WidgetBounds => {
    const r = win.contentRect;
    return r.width > 0 ? r : NOWHERE;
  };

  return {
    id,
    get bounds() { return box(); },
    get hidden() { return win.hidden || win.disposed === true || stops.length < 2 || win.contentRect.width < 120; },
    focusRing: false,
    dispose() {},
    deps: () => [host.factor(), dragging, win.contentRect.x, win.contentRect.y, win.contentRect.width],
    draw(ctx: HudDrawCtx): DrawCommand[] {
      const t = ctx.tokens;
      const shape = track();
      const line = polylineFromPoints(Array.from({ length: SAMPLES + 1 }, (_, i) => shape.at(i / SAMPLES).point));
      const stroke = (color: string, width: number) => ({ paint: { kind: 'solid' as const, color }, width, cap: 'round' as const });
      const out: DrawCommand[] = [
        { kind: 'path', path: line, stroke: stroke(lensTone(t, '--wzl-surface-raised'), 8) },
        { kind: 'path', path: line, stroke: stroke(lensTone(t, '--wzl-border'), 2) },
      ];
      const at = nearestStopIndex(stops, host.factor());
      // An arc's normal points out past the rim and a line's points up, so the lens's middle is against one and along
      // the other.
      const inward = host.round ? -LABEL_GAP : LABEL_GAP;
      const font = { fontFamily: ctx.defaultFont, fontSize: LABEL_PX };
      stops.forEach((stop, i) => {
        const s = shape.at(fractionOf(i));
        const dot = { x: s.point.x - 2, y: s.point.y - 2, width: 4, height: 4 };
        out.push({ kind: 'path', path: ellipsePath(dot), fill: solidFill(lensTone(t, '--wzl-fg-muted')) });
        const label = `${stop}×`;
        const lx = s.point.x + s.normal.x * inward - textWidth(label, LABEL_PX, ctx.defaultFont) / 2;
        const ly = s.point.y + s.normal.y * inward - LABEL_PX / 2;
        const color = i === at ? lensTone(t, '--wzl-fg') : lensTone(t, '--wzl-fg-muted');
        out.push(textCommandFromRuns(lx, ly, [{ text: label, fill: solidFill(color) }], font, undefined, LABEL_PX, 'center'));
      });
      const thumb = shape.at(fractionOf(at)).point;
      const knob = { x: thumb.x - THUMB_R, y: thumb.y - THUMB_R, width: THUMB_R * 2, height: THUMB_R * 2 };
      out.push({
        kind: 'path', path: ellipsePath(knob), fill: solidFill(lensTone(t, '--wzl-accent')),
        stroke: stroke(lensTone(t, '--wzl-surface-raised'), 2),
      });
      return out;
    },
    hitTest: (x, y) => !win.hidden && stopAt(x, y) >= 0,
    cursorAt: (x, y) => (stopAt(x, y) >= 0 ? 'pointer' : 'default'),
    onPointer(evt: HudPointerEvent) {
      if (!('x' in evt) || !Number.isFinite(evt.x) || !Number.isFinite(evt.y)) { dragging = false; return; }
      if (evt.type === 'down') { dragging = true; setFromPointer(evt.x, evt.y); }
      else if (evt.type === 'move' && dragging) setFromPointer(evt.x, evt.y);
      else if (evt.type === 'up') dragging = false;
    },
  };
}

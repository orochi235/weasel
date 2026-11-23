import type { DrawCommand } from '@weasel-js/core/renderer';
import { ellipsePath, polylineFromPoints, type TrackShape } from '@weasel-js/geom';
import { nearestStopIndex } from '@weasel-js/loupe';
import { solidFill } from '@weasel-js/paint';
import type { HudDrawCtx, HudPointerEvent, Widget } from '../widget';
import type { WindowWidget } from '../widgets/window/window';
import { lensTone } from './lensTone';
import { BAND, ringBoundsOf, rimTrackIn } from './rimTracks';
import { textAt } from './textAlong';

const THUMB_R = 6;
/** The track is this share of the thumb's width. */
const TRACK_W = THUMB_R * 2 * 0.6;
const SAMPLES = 48;
const LABEL_PX = 13;
/** Oswald draws `×` at 0.7 the height of its `+`; this brings it level. */
const TIMES_SCALE = 1.4;
/** Px from the track to the centerline its stop labels are set along, outward past the band. */
const LABEL_GAP = BAND / 2 + 9;

/** What the zoom reads of its lens, and tells it. */
export interface ZoomTrackHost {
  win: WindowWidget;
  round: boolean;
  /** Whether the controls are up; hidden, they draw nothing and take no press. */
  shown(): boolean;
  /** The factors it stops at, ascending, spaced evenly along it. */
  stops: readonly number[];
  factor(): number;
  setFactor(factor: number): void;
}

/** A slider on the ring outside a lens that stops at `stops`: a press or drag on its band sets the lens's factor to
 *  the stop nearest the pointer. */
export function createZoomTrack(id: string, host: ZoomTrackHost): Widget {
  const { win, stops } = host;
  const track = (): TrackShape => rimTrackIn(win.bounds, host.round, 'zoom');
  const fractionOf = (i: number): number => (stops.length > 1 ? i / (stops.length - 1) : 0);
  const stopAt = (x: number, y: number): number => {
    const near = track().nearest({ x, y });
    return near.distance <= BAND / 2 ? Math.round(near.f * (stops.length - 1)) : -1;
  };
  let dragging = false;
  /** The factor before the drag in hand, put back if it is canceled. */
  let was = host.factor();
  const setFromPointer = (x: number, y: number) => {
    const near = track().nearest({ x, y });
    host.setFactor(stops[Math.round(near.f * (stops.length - 1))]!);
  };

  return {
    id,
    get bounds() { return ringBoundsOf(win.bounds); },
    get hidden() { return !host.shown() || win.hidden || win.disposed === true || stops.length < 2; },
    focusRing: false,
    dispose() {},
    deps: () => [host.shown(), host.factor(), dragging, win.bounds.x, win.bounds.y, win.bounds.width],
    draw(ctx: HudDrawCtx): DrawCommand[] {
      const t = ctx.tokens;
      const shape = track();
      const stroke = (color: string, width: number) => ({ paint: { kind: 'solid' as const, color }, width });
      const line = polylineFromPoints(Array.from({ length: SAMPLES + 1 }, (_, i) => shape.at(i / SAMPLES).point));
      // Everything here stands on whatever the canvas shows, so each mark is edged in the surface color.
      const halo = lensTone(t, '--wzl-surface');
      const out: DrawCommand[] = [
        { kind: 'path', path: line, stroke: { ...stroke(halo, TRACK_W + 2), cap: 'round' } },
        { kind: 'path', path: line, stroke: { ...stroke(lensTone(t, '--wzl-fg-muted'), TRACK_W), cap: 'round' } },
      ];
      const at = nearestStopIndex(stops, host.factor());
      const labels = rimTrackIn(win.bounds, host.round, 'zoom', LABEL_GAP);
      stops.forEach((stop, i) => {
        const s = shape.at(fractionOf(i));
        const dot = { x: s.point.x - 2, y: s.point.y - 2, width: 4, height: 4 };
        out.push({ kind: 'path', path: ellipsePath(dot), fill: solidFill(lensTone(t, '--wzl-fg-muted')), stroke: stroke(halo, 1) });
        const color = i === at ? lensTone(t, '--wzl-fg') : lensTone(t, '--wzl-fg-muted');
        out.push(...textAt(labels, fractionOf(i), {
          text: [{ text: `${stop}` }, { text: '×', scale: TIMES_SCALE }], fontFamily: ctx.defaultFont, fontSize: LABEL_PX, color, halo,
        }));
      });
      const thumb = shape.at(fractionOf(at)).point;
      const knob = { x: thumb.x - THUMB_R, y: thumb.y - THUMB_R, width: THUMB_R * 2, height: THUMB_R * 2 };
      out.push({
        kind: 'path', path: ellipsePath(knob), fill: solidFill(lensTone(t, '--wzl-accent')),
        stroke: stroke(lensTone(t, '--wzl-surface-raised'), 2),
      });
      return out;
    },
    hitTest: (x, y) => host.shown() && !win.hidden && stopAt(x, y) >= 0,
    cursorAt: (x, y) => (stopAt(x, y) >= 0 ? 'pointer' : 'default'),
    onPointer(evt: HudPointerEvent) {
      if (evt.type === 'cancel') {
        if (dragging) host.setFactor(was);
        dragging = false;
        return;
      }
      if (evt.type !== 'down' && evt.type !== 'move' && evt.type !== 'up') return;
      if (!Number.isFinite(evt.x) || !Number.isFinite(evt.y) || evt.type === 'up') { dragging = false; return; }
      if (evt.type === 'down') { dragging = true; was = host.factor(); setFromPointer(evt.x, evt.y); }
      else if (dragging) setFromPointer(evt.x, evt.y);
    },
  };
}

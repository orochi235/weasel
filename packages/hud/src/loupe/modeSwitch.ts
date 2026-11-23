import type { DrawCommand } from '@weasel-js/core/renderer';
import type { LoupeMode } from '@weasel-js/loupe';
import { solidFill } from '@weasel-js/paint';
import type { HudDrawCtx, HudPointerEvent, Widget } from '../widget';
import type { WindowWidget } from '../widgets/window/window';
import { textWidth } from '../menu/textWidth';
import { lensTone } from './lensTone';
import { iconCommands, type GlyphSource } from '../glyph';
import type { IconSpec } from '@weasel-js/icons';
import { BAND, bandPath, ringBoundsOf, rimTrackIn } from './rimTracks';
import { runAlong, textAlong } from './textAlong';
import { mat3 } from '@weasel-js/geom';

const SEGMENTS: readonly { mode: LoupeMode; label: string }[] = [
  { mode: 'vector', label: 'Vector' },
  { mode: 'pixel', label: 'Pixel' },
];
/** Fraction of the track left empty at each end of a segment, so the two read apart. */
const PAD = 0.015;
const LABEL_PX = 14;
const ICON_PX = 14;
/** Px between a segment's icon and its caption. */
const ICON_GAP = 3;

/** What the switch reads of its lens, and tells it. */
export interface ModeSwitchHost {
  win: WindowWidget;
  round: boolean;
  /** Whether the controls are up; hidden, they draw nothing and take no press. */
  shown(): boolean;
  mode(): LoupeMode;
  setMode(mode: LoupeMode): void;
  /** Where the icons in `modeIcons` are drawn from. */
  icons?: GlyphSource;
  /** An icon for each mode, set before its caption. */
  modeIcons?: Partial<Record<LoupeMode, IconSpec>>;
}

/** A Vector | Pixel switch on the ring outside a lens, beside its zoom. It follows the lens's window, hiding with
 *  it, and lights the lens's current mode; a click on the other segment switches to it. */
export function createModeSwitch(id: string, host: ModeSwitchHost): Widget {
  const { win } = host;
  const track = () => rimTrackIn(win.bounds, host.round, 'mode');
  const segmentAt = (x: number, y: number): number => {
    const near = track().nearest({ x, y });
    return near.distance <= BAND / 2 ? Math.min(SEGMENTS.length - 1, Math.floor(near.f * SEGMENTS.length)) : -1;
  };
  let hovered = -1;
  let held = -1;

  return {
    id,
    get bounds() { return ringBoundsOf(win.bounds); },
    get hidden() { return !host.shown() || win.hidden || win.disposed === true; },
    focusRing: false,
    dispose() {},
    deps: () => [host.shown(), host.mode(), hovered, held, win.bounds.x, win.bounds.y, win.bounds.width],
    draw(ctx: HudDrawCtx): DrawCommand[] {
      const t = ctx.tokens;
      const shape = track();
      const share = 1 / SEGMENTS.length;
      return SEGMENTS.flatMap((s, i): DrawCommand[] => {
        const on = host.mode() === s.mode;
        const fill = held === i || on ? '--wzl-surface-pressed' : hovered === i ? '--wzl-surface-hover' : '--wzl-surface-raised';
        const mid = share * (i + 0.5);
        const color = lensTone(t, on ? '--wzl-accent-fg' : '--wzl-fg');
        const spec = host.icons ? host.modeIcons?.[s.mode] : undefined;
        const lead = spec ? ICON_PX + ICON_GAP : 0;
        const text = { text: s.label, fontFamily: ctx.defaultFont, fontSize: LABEL_PX, color, lead };
        const out: DrawCommand[] = [{
          kind: 'path', path: bandPath(shape, share * i + PAD, share * (i + 1) - PAD),
          fill: solidFill(lensTone(t, fill)),
          stroke: { paint: { kind: 'solid', color: lensTone(t, '--wzl-border') }, width: 1 },
        }];
        if (spec) {
          // The icon leads the caption along the arc, turned to the track's heading where it stands.
          const run = runAlong(shape, mid, lead + textWidth(s.label, LABEL_PX, ctx.defaultFont));
          const { point, tangent } = shape.at(run.at(ICON_PX / 2));
          const turn = Math.atan2(tangent.y, tangent.x) + (run.flip ? Math.PI : 0);
          const cos = Math.cos(turn), sin = Math.sin(turn);
          out.push({
            kind: 'group', transform: mat3.fromAffine([cos, sin, -sin, cos, point.x, point.y]),
            children: iconCommands(host.icons!, spec, { x: -ICON_PX / 2, y: -ICON_PX / 2, size: ICON_PX, color }),
          });
        }
        out.push(...textAlong(shape, mid, text));
        return out;
      });
    },
    hitTest: (x, y) => host.shown() && !win.hidden && segmentAt(x, y) >= 0,
    cursorAt: (x, y) => (segmentAt(x, y) >= 0 ? 'pointer' : 'default'),
    onPointer(evt: HudPointerEvent) {
      const at = 'x' in evt && Number.isFinite(evt.x) && Number.isFinite(evt.y) ? segmentAt(evt.x, evt.y) : -1;
      if (evt.type === 'hovermove') hovered = at;
      else if (evt.type === 'hoverleave') hovered = -1;
      else if (evt.type === 'down') held = at;
      else if (evt.type === 'up') {
        if (held >= 0 && held === at) host.setMode(SEGMENTS[at]!.mode);
        held = -1;
      } else if (evt.type === 'cancel') held = -1;
    },
  };
}

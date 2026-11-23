import { textCommandFromRuns } from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';
import type { LoupeMode } from '@weasel-js/loupe';
import { solidFill } from '@weasel-js/paint';
import type { HudDrawCtx, HudPointerEvent, Widget } from '../widget';
import type { WindowWidget } from '../widgets/window/window';
import { textWidth } from '../menu/textWidth';
import { lensTone } from './lensTone';
import { iconCommands, type GlyphSource } from '../glyph';
import type { IconSpec } from '@weasel-js/icons';
import { BAND, bandPath, outwardOf, ringBoundsOf, rimTrackIn } from './rimTracks';

const SEGMENTS: readonly { mode: LoupeMode; label: string }[] = [
  { mode: 'vector', label: 'Vector' },
  { mode: 'pixel', label: 'Pixel' },
];
/** Fraction of the track left empty at each end of a segment, so the two read apart. */
const PAD = 0.015;
const LABEL_PX = 10;
const ICON_PX = 12;
/** Px from the track's centerline to a caption's nearest point, outward past the band. */
const CAPTION_GAP = BAND / 2 + 4;

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
      const font = { fontFamily: ctx.defaultFont, fontSize: LABEL_PX };
      return SEGMENTS.flatMap((s, i): DrawCommand[] => {
        const on = host.mode() === s.mode;
        const fill = held === i || on ? '--wzl-surface-pressed' : hovered === i ? '--wzl-surface-hover' : '--wzl-surface-raised';
        const { point: mid, normal } = shape.at(share * (i + 0.5));
        const color = lensTone(t, on ? '--wzl-accent-fg' : '--wzl-fg');
        const spec = host.modeIcons?.[s.mode];
        const placed = spec && host.icons
          ? iconCommands(host.icons, spec, { x: mid.x - ICON_PX / 2, y: mid.y - ICON_PX / 2, size: ICON_PX, color })
          : [];
        // With an icon in the band, the caption sits outside it, as the zoom's stop labels do.
        const away = placed.length > 0 ? outwardOf(host.round) * CAPTION_GAP : 0;
        const w = textWidth(s.label, LABEL_PX, ctx.defaultFont);
        const cx = mid.x + normal.x * away, cy = mid.y + normal.y * away;
        // Pushed out by half its own box along the normal, so its nearest side, not its middle, keeps the gap.
        const left = cx - w / 2 + ((normal.x * w) / 2) * Math.sign(away);
        const top = cy - LABEL_PX / 2 + ((normal.y * LABEL_PX) / 2) * Math.sign(away);
        return [
          {
            kind: 'path', path: bandPath(shape, share * i + PAD, share * (i + 1) - PAD),
            fill: solidFill(lensTone(t, fill)),
            stroke: { paint: { kind: 'solid', color: lensTone(t, '--wzl-border') }, width: 1 },
          },
          ...placed,
          textCommandFromRuns(
            left, top, [{ text: s.label, fill: solidFill(color) }],
            font, undefined, LABEL_PX, 'center',
          ),
        ];
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

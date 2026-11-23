import type { DrawCommand } from '@weasel-js/core/renderer';
import type { LoupeAimMode } from '@weasel-js/loupe';
import type { IconSpec } from '@weasel-js/icons';
import type { HudDrawCtx, HudPointerEvent, Widget, WidgetBounds } from '../widget';
import type { WindowWidget } from '../widgets/window/window';
import type { GlyphSource } from '../glyph';
import { lensTone } from './lensTone';
import { PIN_DOCK_REACH, PIN_ICON_PX, PIN_TARGET_R, pinDock, pinLeader, pinNeedle } from './pinDraw';
import { BAND, pinDockIn, ringBoundsOf } from './rimTracks';

type Point = { x: number; y: number };

/** Px a press travels before it is a drag rather than a click. */
const SLOP = 3;

/** What the pin reads of its lens, and tells it. */
export interface PinHandleHost {
  win: WindowWidget;
  round: boolean;
  /** Whether the controls are up; hidden, the pin draws nothing at rest and takes no press. */
  shown(): boolean;
  aimMode(): LoupeAimMode;
  /** Where the lens is aimed: its pin's target, while pinned. */
  aim(): Point;
  pinAt(p: Point): void;
  setAimMode(mode: LoupeAimMode): void;
  icons?: GlyphSource;
  /** The pin's icon; without one (or `icons`) a plain needle is drawn. */
  pinIcon?: IconSpec;
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const union = (a: WidgetBounds, p: Point, r: number): WidgetBounds => {
  const x = Math.min(a.x, p.x - r), y = Math.min(a.y, p.y - r);
  return { x, y, width: Math.max(a.x + a.width, p.x + r) - x, height: Math.max(a.y + a.height, p.y + r) - y };
};

/**
 * A pin docked on a lens's ring. Dragged onto the canvas, it pins the lens's aim where it is dropped, and returns to
 * its dock lit; while the ring shows, an open dashed circle marks the target, a dashed line running to it from the
 * pin. A click on the docked pin lets the aim follow again, or pins it where it is. The target circle drags too.
 */
export function createPinHandle(id: string, host: PinHandleHost): Widget {
  const { win } = host;
  const dock = () => pinDockIn(win.bounds, host.round);
  const pinned = () => host.aimMode() === 'pinned';
  /** The press in hand: what it grabbed, where it began, how the lens was aimed then, and where it is dragged. */
  let press: { from: 'dock' | 'target'; start: Point; was: LoupeAimMode; wasAim: Point; at: Point | null } | null = null;
  let hovered = false;

  const grabbable = (p: Point): 'dock' | 'target' | null => {
    if (!host.shown() || win.hidden) return null;
    if (dist(p, dock()) <= PIN_DOCK_REACH) return 'dock';
    if (pinned() && dist(p, host.aim()) <= PIN_TARGET_R + 4) return 'target';
    return null;
  };
  /** Over the lens or its ring: a drop there takes the pin back. */
  const overLens = (p: Point) => {
    const b = win.bounds;
    const c = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    return host.round ? dist(p, c) <= b.width / 2 + BAND + 8 : win.hitTest(p.x, p.y);
  };

  const glyph = { ...(host.icons ? { icons: host.icons } : {}), ...(host.pinIcon ? { icon: host.pinIcon } : {}) };
  const dockOf = (ctx: HudDrawCtx, holds: boolean): DrawCommand[] =>
    pinDock(ctx.tokens, glyph, dock(), { on: pinned() || press?.from === 'dock', hovered, lit: pinned(), holds });

  return {
    id,
    get bounds() {
      let b = ringBoundsOf(win.bounds);
      if (pinned()) b = union(b, host.aim(), PIN_TARGET_R + 4);
      if (press?.at) b = union(b, press.at, PIN_ICON_PX + PIN_TARGET_R);
      return b;
    },
    // Up with the ring, and through a drag of its own wherever the pointer takes it.
    get hidden() { return win.hidden || win.disposed === true || (!host.shown() && press === null); },
    focusRing: false,
    dispose() {},
    deps: () => {
      const aim = host.aim();
      return [host.shown(), host.aimMode(), aim.x, aim.y, press?.at?.x, press?.at?.y, hovered, win.bounds.x, win.bounds.y, win.bounds.width];
    },
    draw(ctx: HudDrawCtx): DrawCommand[] {
      if (press?.at) {
        // Carried: the needle rides the pointer, its target under the tip, and the dock waits empty.
        const ink = lensTone(ctx.tokens, '--wzl-fg');
        return [...dockOf(ctx, false), ...pinLeader(ctx.tokens, dock(), press.at), ...pinNeedle(glyph, press.at, ink)];
      }
      if (!host.shown()) return [];
      return [...(pinned() ? pinLeader(ctx.tokens, dock(), host.aim()) : []), ...dockOf(ctx, true)];
    },
    hitTest: (x, y) => press !== null || grabbable({ x, y }) !== null,
    cursorAt: (x, y) => (press?.at ? 'grabbing' : grabbable({ x, y }) ? 'grab' : 'default'),
    onPointer(evt: HudPointerEvent) {
      const p = 'x' in evt && Number.isFinite(evt.x) && Number.isFinite(evt.y) ? { x: evt.x, y: evt.y } : null;
      if (evt.type === 'hovermove') { hovered = p !== null && grabbable(p) === 'dock'; return; }
      if (evt.type === 'hoverleave') { hovered = false; return; }
      if (evt.type === 'down') {
        const from = p && grabbable(p);
        press = from ? { from, start: p!, was: host.aimMode(), wasAim: host.aim(), at: null } : null;
        return;
      }
      if (!press) return;
      if (evt.type === 'move' && p) {
        if (!press.at && dist(p, press.start) < SLOP) return;
        press.at = p;
        if (!overLens(p)) host.pinAt(p);
        return;
      }
      const was = press;
      press = null;
      if (evt.type === 'cancel' || !p) {
        if (was.was === 'follow') host.setAimMode('follow');
        else host.pinAt(was.wasAim);
        return;
      }
      if (evt.type !== 'up') return;
      if (!was.at) {
        // A click: the docked pin toggles; the target stays where it is.
        if (was.from === 'dock') host.setAimMode(was.was === 'pinned' ? 'follow' : 'pinned');
        return;
      }
      if (overLens(p)) host.setAimMode('follow');
      else host.pinAt(p);
    },
  };
}

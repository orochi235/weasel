import type { LoupePoint } from './geometry';
import type { LoupeAimMode, LoupeSurface } from './model';

/** Where a loupe is aimed, and what that aim follows. */
export interface LoupeAim {
  readonly mode: LoupeAimMode;
  /** The aim now: the last point followed, or where the pin stands on the surface. */
  now(): LoupePoint;
  /** Takes `p` as the aim, unless pinned. Whether it took it. */
  follow(p: LoupePoint): boolean;
  /** Pins the content under `p`. */
  pin(p: LoupePoint): void;
  /** Pins the content under the aim now, or follows again from where the pin stands. Whether it changed. */
  setMode(mode: LoupeAimMode): boolean;
}

/** An aim over `surface`, starting at its origin. A pin is held as the content point `surface.worldAt` gives, so it
 *  stays on what it was put on as the surface's camera moves; a surface that cannot say holds its surface point. */
export function createLoupeAim(surface: LoupeSurface, mode: LoupeAimMode): LoupeAim {
  let followed: LoupePoint = { x: 0, y: 0 };
  const held = (p: LoupePoint) => surface.worldAt?.(p) ?? p;
  let pinned: LoupePoint | null = mode === 'pinned' ? held(followed) : null;
  const now = () => (pinned ? (surface.pointFor?.(pinned) ?? pinned) : followed);
  return {
    get mode() { return pinned ? 'pinned' : 'follow'; },
    now,
    follow(p) {
      if (pinned) return false;
      followed = p;
      return true;
    },
    pin(p) { pinned = held(p); },
    setMode(next) {
      if ((pinned !== null) === (next === 'pinned')) return false;
      if (next === 'pinned') pinned = held(followed);
      else { followed = now(); pinned = null; }
      return true;
    },
  };
}

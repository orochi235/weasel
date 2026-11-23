/** Two or more pointers down at once: their geometry, and whether the episode was a tap. */
import { TAP_THRESHOLD_PX } from './thresholds';

/** A position in whatever space the recognizer's `positionOf` reports. */
export interface Point { x: number; y: number }

/** Where two or more pointers sit: what `multiTouchGeometry` reads from their positions. */
export interface MultiTouchGeometry {
  centroid: Point;
  /** Distance between the first two pointers. */
  spread: number;
  /** Direction from the first pointer to the second, in degrees in (-180, 180],
   *  growing clockwise on screen. */
  angle: number;
}

/** Every pointer's centroid, and the first two's spread and angle. All zero with fewer than 2 pointers. */
export function multiTouchGeometry(positions: Iterable<Point>): MultiTouchGeometry {
  const pts = [...positions];
  if (pts.length < 2) return { centroid: { x: 0, y: 0 }, spread: 0, angle: 0 };
  let sumX = 0;
  let sumY = 0;
  for (const p of pts) {
    sumX += p.x;
    sumY += p.y;
  }
  const dx = pts[1]!.x - pts[0]!.x;
  const dy = pts[1]!.y - pts[0]!.y;
  // atan2 gives -180 for a dy of -0 or one too small to move it off -180.
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  return {
    centroid: { x: sumX / pts.length, y: sumY / pts.length },
    spread: Math.hypot(dx, dy),
    angle: angle === -180 ? 180 : angle,
  };
}

interface Episode {
  /** The most fingers down at once. */
  fingers: number;
  /** A finger joined already spent on a drag or a long-press, so the episode is no tap. */
  spent: boolean;
  /** Where each finger was when it joined: a pinch about a still center moves
   *  every finger and no centroid. */
  joinedAt: Map<number, Point>;
  moved: boolean;
  startedAt: number;
}

/** A held finger as an episode reads it on joining. */
export interface EpisodeFinger {
  pos: Point;
  pressedAt: number;
  /** Its press is still unspent: no drag opened from it and no long-press took it. */
  fresh: boolean;
}

export interface MultiTouchEpisode {
  /** A finger landed with at least two now down. `hand` is every held finger. */
  join(hand: ReadonlyMap<number, EpisodeFinger>): void;
  moved(pointerId: number, to: Point): void;
  /**
   * The hand dropped below two fingers. The peak finger count when the
   * episode was a tap: brief, and no finger moved.
   */
  finish(now: number, maxHoldMs: number): number | null;
  /** End the episode with no tap. */
  abandon(): void;
}

/** `tapPx` is how far a finger or the centroid may travel and still tap, read as each is measured. */
export function createMultiTouchEpisode(tapPx: () => number = () => TAP_THRESHOLD_PX): MultiTouchEpisode {
  let episode: Episode | null = null;
  return {
    join(hand) {
      episode ??= { fingers: 0, spent: false, joinedAt: new Map(), moved: false, startedAt: Infinity };
      episode.fingers = Math.max(episode.fingers, hand.size);
      for (const [id, f] of hand) {
        if (episode.joinedAt.has(id)) continue;
        episode.joinedAt.set(id, { ...f.pos });
        episode.startedAt = Math.min(episode.startedAt, f.pressedAt);
        if (!f.fresh) episode.spent = true;
      }
    },
    moved(pointerId, to) {
      const from = episode?.joinedAt.get(pointerId);
      if (episode && from && Math.hypot(to.x - from.x, to.y - from.y) > tapPx()) episode.moved = true;
    },
    finish(now, maxHoldMs) {
      const e = episode;
      episode = null;
      if (!e) return null;
      // A hold as long as a long-press is not a tap, for two fingers as for one,
      // timed from the first finger's press.
      const brief = now - e.startedAt < maxHoldMs;
      return brief && !e.moved && !e.spent ? e.fingers : null;
    },
    abandon() { episode = null; },
  };
}

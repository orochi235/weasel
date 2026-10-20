/**
 * Line jumps as data: the document value that turns them on, and the hops a
 * connector carries. Plain data, so layout and any reader can use it.
 */
import type { Vec2 } from '@weasel-js/core/math';

/** The document value (`scene.doc`) holding the line-jump setting: present
 *  while hops are on, absent while off. */
export const HOPS_DOC_KEY = 'diagram:hops';

/** The line-jump setting while it is on. */
export interface HopsDocValue {
  /** A hop's radius, in world units. */
  size: number;
}

/** The radius a hop takes when nothing sets one. */
export const DEFAULT_HOP_SIZE = 5;

/** Where a connector bows over others: a half circle of radius `r` centered
 *  on `at`, which lies on the connector's route. `over` names the connectors
 *  it passes over; hops closer than `2r` merge into one, which passes over all
 *  of theirs. */
export interface EdgeHop {
  at: Vec2;
  over: readonly string[];
  r: number;
}

import type { BaseModule } from './types';
import ChamferedRect, { type ChamferedRectParams } from './ChamferedRect';
import RoundedRect, { type RoundedRectParams } from './RoundedRect';

export type BadgeBase = 'chamfered-rect' | 'rounded-rect';

export interface BadgeBaseParams {
  'chamfered-rect': ChamferedRectParams;
  'rounded-rect': RoundedRectParams;
}

export const BASES: Record<BadgeBase, BaseModule<any>> = {
  'chamfered-rect': ChamferedRect,
  'rounded-rect': RoundedRect,
};

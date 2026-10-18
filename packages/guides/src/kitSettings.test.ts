import { describe, expect, it } from 'vitest';
import { DEFAULT_GUIDE_TOLERANCE_PX } from './strategies/guides';
import { guidesKitSettingsSchema } from './kitSettings';

describe('guidesKitSettingsSchema', () => {
  it('defaults every leaf to its constant', () => {
    expect(guidesKitSettingsSchema.children.targets.children.guideSnapPx.default).toBe(DEFAULT_GUIDE_TOLERANCE_PX);
  });
});

import { describe, expect, it } from 'vitest';
import { WHEEL_RATE } from './loupe/loupeActions';
import { labkitKitSettingsSchema } from './kitSettings';

describe('labkitKitSettingsSchema', () => {
  it('defaults every leaf to its constant', () => {
    expect(labkitKitSettingsSchema.children.loupe.children.wheelRate.default).toBe(WHEEL_RATE);
  });
});

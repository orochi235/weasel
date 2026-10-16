import { describe, expect, it } from 'vitest';
import { labkitKitSettingsSchema } from './kitSettings';
import { WHEEL_RATE } from './loupe/loupeActions';

describe('labkitKitSettingsSchema', () => {
  it('defaults every leaf to its constant', () => {
    expect(labkitKitSettingsSchema.children.loupe.children.wheelRate.default).toBe(WHEEL_RATE);
  });
});

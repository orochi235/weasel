import { LOUPE_WHEEL_RATE } from '@weasel-js/loupe';
import { describe, expect, it } from 'vitest';
import { labkitKitSettingsSchema } from './kitSettings';

describe('labkitKitSettingsSchema', () => {
  it('defaults every leaf to its constant', () => {
    expect(labkitKitSettingsSchema.children.loupe.children.wheelRate.default).toBe(LOUPE_WHEEL_RATE);
  });
});

import { describe, expect, it } from 'vitest';
import { AUDIO_PACKAGE } from '@weasel-js/audio';

describe('@weasel-js/audio', () => {
  it('resolves through the workspace alias', () => {
    expect(AUDIO_PACKAGE).toBe('@weasel-js/audio');
  });
});

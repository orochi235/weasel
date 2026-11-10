import { describe, expect, it } from 'vitest';
import { bindClip, toClip, type Clip } from './clip';

describe('clips, shrunk from the property tests', () => {
  it('keep a key value own `__proto__` field through bindClip and toClip', () => {
    const clip = JSON.parse('{"version":1,"tracks":[{"kind":"sampled","keys":[{"t":0,"value":{"__proto__":0,"x":0}}]}]}') as Clip;
    expect(JSON.stringify(toClip(bindClip(clip, {})))).toBe(JSON.stringify(clip));
  });
});

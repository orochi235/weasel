import { describe, expect, it } from 'vitest';
import { checkClip } from './clipShape';

const withKey = (key: object) => ({ version: 1, tracks: [{ kind: 'sampled', keys: [{ t: 0, value: 0 }, key] }] });

describe('checkClip', () => {
  it('refuses a key with no value, naming it', () => {
    expect(() => checkClip(JSON.parse(JSON.stringify(withKey({ t: 50, value: undefined }))))).toThrow(
      "bindClip: track 0's key 1 has no value.",
    );
  });

  it('takes a key whose value is null', () => {
    expect(() => checkClip(withKey({ t: 50, value: null }))).not.toThrow();
  });
});

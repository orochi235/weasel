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

  it('refuses keys out of time order, naming the key', () => {
    expect(() => checkClip({ version: 1, tracks: [{ kind: 'sampled', keys: [{ t: 100, value: 0 }, { t: 0, value: 1 }] }] })).toThrow(
      "bindClip: track 0's key 1's t is before the key ahead of it.",
    );
  });

  it('refuses events out of time order, naming the event', () => {
    expect(() => checkClip({ version: 1, tracks: [{ kind: 'event', events: [{ t: 50, name: 'a' }, { t: 10, name: 'b' }] }] })).toThrow(
      "bindClip: track 0's event 1's t is before the event ahead of it.",
    );
  });

  it('takes keys at one time', () => {
    expect(() => checkClip(withKey({ t: 0, value: 1 }))).not.toThrow();
  });
});

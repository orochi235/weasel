import { describe, expect, it } from 'vitest';
import { type CapturePayload, parsePayload } from './payload';

const valid: CapturePayload = {
  story: 'ui-button--primary',
  isolate: false,
  config: { label: 'Go' },
  state: { count: 2 },
  globals: { mode: 'dark' },
  overrides: { '--wzl-accent': 'red' },
  playhead: 120,
  box: { width: 320, height: 200 },
  layout: 'centered',
  dpr: 2,
  scroll: { left: 0, top: 0 },
  lab: { globals: { theme: 'chrome' }, mode: 'dark' },
};

describe('parsePayload', () => {
  it('accepts a whole payload as sent', () => {
    expect(parsePayload(valid)).toEqual(valid);
    expect(parsePayload({ ...valid, scroll: { left: 12.5, top: 300 } })).toEqual({ ...valid, scroll: { left: 12.5, top: 300 } });
    expect(parsePayload({ ...valid, playhead: null, isolate: true })).toEqual({ ...valid, playhead: null, isolate: true });
  });

  it('rejects a payload whose dpr is out of range or whose box is empty', () => {
    for (const dpr of [0.5, 3.5, Number.NaN]) {
      expect(parsePayload({ ...valid, dpr })).toEqual({ error: expect.stringContaining('dpr') });
    }
    for (const box of [{ width: 0, height: 200 }, { width: 320, height: 0 }, { width: -1, height: 5 }, null]) {
      expect(parsePayload({ ...valid, box })).toEqual({ error: expect.stringContaining('box') });
    }
  });

  it('names the field it rejects', () => {
    expect(parsePayload(null)).toEqual({ error: expect.stringContaining('object') });
    expect(parsePayload({ ...valid, story: 3 })).toEqual({ error: expect.stringContaining('story') });
    expect(parsePayload({ ...valid, layout: 'tiled' })).toEqual({ error: expect.stringContaining('layout') });
    expect(parsePayload({ ...valid, overrides: { '--x': 1 } })).toEqual({ error: expect.stringContaining('overrides') });
    expect(parsePayload({ ...valid, playhead: 'soon' })).toEqual({ error: expect.stringContaining('playhead') });
    expect(parsePayload({ ...valid, globals: [] })).toEqual({ error: expect.stringContaining('globals') });
    expect(parsePayload({ ...valid, lab: { globals: {}, mode: 'auto' } })).toEqual({ error: expect.stringContaining('lab') });
    expect(parsePayload({ ...valid, lab: undefined })).toEqual({ error: expect.stringContaining('lab') });
    for (const scroll of [undefined, { left: 0 }, { left: Number.NaN, top: 0 }, { left: 0, top: '3' }]) {
      expect(parsePayload({ ...valid, scroll })).toEqual({ error: expect.stringContaining('scroll') });
    }
  });

  it('rejects an override whose name is not a custom property, or whose value could close the rule', () => {
    for (const name of ['color', '--a} b{c:d', '--a b']) {
      expect(parsePayload({ ...valid, overrides: { [name]: 'red' } })).toEqual({ error: expect.stringContaining('overrides') });
    }
    for (const value of ['x} [data-fg-capture]{background:url(http://10.0.0.1/any.png)} b{c:d', 'a{', 'red; color: blue']) {
      expect(parsePayload({ ...valid, overrides: { '--wzl-accent': value } })).toEqual({ error: expect.stringContaining('overrides') });
    }
  });

  it('drops fields the payload does not define', () => {
    expect(parsePayload({ ...valid, extra: 1 })).toEqual(valid);
  });
});

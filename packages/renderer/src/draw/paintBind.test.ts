import { afterEach, describe, expect, it, vi } from 'vitest';
import { paintDrawKind } from './paintBind';
import { registerPaintDrawKindLoader } from '../paintKinds';

describe('paintDrawKind', () => {
  afterEach(() => vi.restoreAllMocks());

  it('warns once for a kind nothing registers', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(paintDrawKind('linar-gradient')).toBeUndefined();
    expect(paintDrawKind('linar-gradient')).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('"linar-gradient"');
  });

  it('stays quiet for a kind whose loader has not landed yet', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const drop = registerPaintDrawKindLoader('still-loading', () => new Promise(() => {}));
    expect(paintDrawKind('still-loading')).toBeUndefined();
    drop();
    expect(warn).not.toHaveBeenCalled();
  });
});

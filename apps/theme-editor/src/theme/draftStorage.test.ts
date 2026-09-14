import { afterEach, describe, expect, it, vi } from 'vitest';
import { draftNames, parseDraft, persistDraft } from './draftStorage';

describe('parseDraft', () => {
  const draft = { definition: { name: 'weasel', description: 'x' }, baseHash: 'h1' };

  it('reads a draft of the named theme', () => {
    expect(parseDraft(JSON.stringify(draft), 'weasel')).toEqual(draft);
    expect(parseDraft(JSON.stringify({ ...draft, baseHash: null }), 'weasel')?.baseHash).toBeNull();
  });

  it('rejects anything else rather than trusting it', () => {
    expect(parseDraft(null, 'weasel')).toBeNull();
    expect(parseDraft('{', 'weasel')).toBeNull();
    expect(parseDraft(JSON.stringify(draft), 'interstellar')).toBeNull();
    expect(parseDraft(JSON.stringify({ ...draft, baseHash: 3 }), 'weasel')).toBeNull();
    expect(parseDraft(JSON.stringify({ baseHash: 'h1' }), 'weasel')).toBeNull();
  });
});

describe('draftNames', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lists the themes with a draft in storage, and nothing when there is no storage', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(draftNames()).toEqual([]);
    const items = new Map<string, string>([['weasel.theme-editor.theme', 'harbor']]);
    vi.stubGlobal('localStorage', {
      get length() {
        return items.size;
      },
      key: (i: number) => [...items.keys()][i] ?? null,
      setItem: (k: string, v: string) => void items.set(k, v),
    });
    persistDraft({ definition: { name: 'harbor' }, baseHash: null });
    expect(draftNames()).toEqual(['harbor']);
  });
});

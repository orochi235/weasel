import { afterEach, describe, expect, it, vi } from 'vitest';
import { draftNames, loadDraft, parseDraft, persistDraft } from './draftStorage';

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

describe('loadDraft', () => {
  afterEach(() => localStorage.clear());

  it('keeps a draft it cannot read aside, so the next save cannot cost it, and does not list the copy', () => {
    const key = 'weasel.theme-editor.draft.harbor';
    localStorage.setItem(key, '{"definition":');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(loadDraft('harbor')).toBeNull();
    expect(localStorage.getItem(`${key}:unreadable`)).toBe('{"definition":');
    persistDraft({ definition: { name: 'harbor' }, baseHash: null });
    expect(localStorage.getItem(`${key}:unreadable`)).toBe('{"definition":');
    expect(draftNames()).toEqual(['harbor']);
  });
});

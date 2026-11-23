import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearDraft, clearDraftHistory, draftHistory, draftNames, KEPT_HISTORIES, loadDraft, parseDraft, persistDraft, pruneDraftHistories } from './draftStorage';

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
      getItem: (key: string) => items.get(key) ?? null,
    });
    items.set('weasel.theme-editor.draft.harbor', '{}');
    expect(draftNames()).toEqual(['harbor']);
  });
});

describe('loadDraft', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('keeps a draft it cannot read aside, so the next save cannot cost it, and does not list the copy', async () => {
    const key = 'weasel.theme-editor.draft.harbor';
    localStorage.setItem(key, '{"definition":');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(loadDraft('harbor')).toBeNull();
    // Kept as the value it read: text that is not JSON, written as a JSON string.
    const aside = () => JSON.parse(localStorage.getItem(`${key}:unreadable`)!) as unknown;
    expect(aside()).toBe('{"definition":');
    expect(await persistDraft({ definition: { name: 'harbor' }, baseHash: null })).toBe(true);
    expect(aside()).toBe('{"definition":');
    expect(draftNames()).toEqual(['harbor']);
  });

  it('neither saves over nor clears a draft it cannot read while the copy aside will not save', async () => {
    const key = 'weasel.theme-editor.draft.harbor';
    localStorage.setItem(key, '{"definition":');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k, v) {
      if (k === `${key}:unreadable`) throw new DOMException('full', 'QuotaExceededError');
      setItem.call(this, k, v);
    });
    expect(loadDraft('harbor')).toBeNull();
    expect(await persistDraft({ definition: { name: 'harbor' }, baseHash: null })).toBe(false);
    expect(await clearDraft('harbor')).toBe(false);
    expect(localStorage.getItem(key)).toBe('{"definition":');
  });
});

describe('draftHistory', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  const saved = (name: string) => ({
    state: { name },
    history: { version: 1 as const, undoStack: [], redoStack: [], nextEntryId: 1, droppedEntries: 0 },
  });
  const save = (name: string) => draftHistory(name).save(saved(name));
  const kept = () => ['a', 'b', 'c'].filter((n) => draftHistory(n).load() !== null);

  it('keeps the histories of only the themes saved most recently', () => {
    save('a');
    save('b');
    save('a');
    save('c');
    expect(KEPT_HISTORIES).toBe(2);
    expect(kept()).toEqual(['a', 'c']);
  });

  it('finds histories saved before their order was kept', () => {
    localStorage.setItem('weasel.theme-editor.draft-history.a', JSON.stringify(saved('a')));
    localStorage.setItem('weasel.theme-editor.draft-history.b', JSON.stringify(saved('b')));
    save('c');
    expect(kept()).toHaveLength(2);
    expect(kept()).toContain('c');
  });

  it("forgets every other theme's history when the browser refuses one for room", () => {
    save('a');
    const real = Storage.prototype.setItem;
    let refused = false;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key.endsWith('draft-history.b') && !refused) {
        refused = true;
        throw new DOMException('full', 'QuotaExceededError');
      }
      real.call(this, key, value);
    });
    save('b');
    expect(kept()).toEqual(['b']);
  });

  it('forgets the history of a theme no longer listed, and of a discarded one', () => {
    save('a');
    save('b');
    pruneDraftHistories(['b', 'c']);
    expect(kept()).toEqual(['b']);
    clearDraftHistory('b');
    expect(kept()).toEqual([]);
    expect(localStorage.getItem('weasel.theme-editor.draft-histories')).toBeNull();
  });
});

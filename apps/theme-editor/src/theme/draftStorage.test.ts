import { describe, expect, it } from 'vitest';
import { parseDraft } from './draftStorage';

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

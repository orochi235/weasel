import { describe, expect, it } from 'vitest';
import { FALLBACK_MIN_ENTRIES, summarize, type ChangelogEntry, type Tag } from './releases';

const entry = (id: string, tags: Tag[]): ChangelogEntry =>
  ({ id, packages: ['core'], titleHtml: id, bodyHtml: '', tags, rank: 0, pick: false });

describe('summarize', () => {
  it('counts only entries outside Internal toward the fallback threshold', () => {
    const internal = Array.from({ length: FALLBACK_MIN_ENTRIES - 1 }, (_, i) => entry(`i${i}`, ['internal']));
    const summary = summarize({ version: '1.0.0', entries: [...internal, entry('f', ['fix'])] });
    expect(summary.highlights).toEqual([]);
  });

  it('falls back to highlights once enough entries are outside Internal', () => {
    const fixes = Array.from({ length: FALLBACK_MIN_ENTRIES }, (_, i) => entry(`f${i}`, ['fix']));
    const summary = summarize({ version: '1.0.0', entries: [...fixes, entry('i', ['internal'])] });
    expect(summary.highlights.map((h) => h.id)).not.toContain('i');
    expect(summary.highlights).toHaveLength(3);
  });
});

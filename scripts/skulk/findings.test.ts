import { describe, expect, it } from 'vitest';
import { citedPaths, firstJson, parseFilesRead, parseFindings, validPairs } from './findings.mjs';
import { appendRecordRow } from './record.mjs';
import { mayStartArea, parseEnvelope } from './usage.mjs';

const REPORT = `# Audit — core

## A cache never evicts
- where: packages/core/src/cache.ts:12 (memo), apps/draw/src/App.tsx:4
- scenario: x → y
- evidence: read
- severity: medium

## Teardown leaves a listener
- where: packages/core/src/view.ts:40
- severity: low

## Files read
- packages/core/src/cache.ts
- \`packages/core/src/view.ts\`

<!-- done: 2 findings, files read: 2 -->
`;

describe('parseFindings', () => {
  it('reads each ## section as one finding, and not the files-read list', () => {
    const found = parseFindings(REPORT);
    expect(found.map((f: { claim: string }) => f.claim)).toEqual(['A cache never evicts', 'Teardown leaves a listener']);
    expect(found[0].where).toBe('packages/core/src/cache.ts:12 (memo), apps/draw/src/App.tsx:4');
    expect(citedPaths(found[0])).toEqual(['packages/core/src/cache.ts', 'apps/draw/src/App.tsx']);
    expect(parseFilesRead(REPORT)).toEqual(['packages/core/src/cache.ts', 'packages/core/src/view.ts']);
  });

  it('answers nothing for an empty report', () => {
    expect(parseFindings('')).toEqual([]);
    expect(parseFilesRead('')).toEqual([]);
  });
});

describe('validPairs', () => {
  it('drops out-of-range and reused indexes, so each shared defect counts once', () => {
    expect(validPairs([[0, 0], [0, 1], [1, 0], [2, 2], [5, 1], [1, 1], ['x', 1]], 3, 2)).toEqual([[0, 0], [1, 1]]);
    expect(validPairs(undefined, 3, 3)).toEqual([]);
  });

  it('reads the first JSON object out of a fenced reply', () => {
    expect(firstJson('```json\n{"pairs": [[0, 1]]}\n```')).toEqual({ pairs: [[0, 1]] });
    expect(() => firstJson('no pairs')).toThrow();
  });
});

describe('usage', () => {
  it('sums every kind of token in an envelope and flags a job stopped by its dollar ceiling', () => {
    const { reply, record } = parseEnvelope(JSON.stringify({
      result: 'ok', total_cost_usd: 1.5, duration_ms: 900, terminal_reason: 'completed', subtype: 'success',
      usage: { input_tokens: 2, output_tokens: 10, cache_creation_input_tokens: 100, cache_read_input_tokens: 1000 },
      modelUsage: { 'claude-x': { costUSD: 1.5 } },
    }));
    expect(reply).toBe('ok');
    expect(record).toMatchObject({ totalTokens: 1112, costUsd: 1.5, models: ['claude-x'], budgetHit: false });
    expect(parseEnvelope(JSON.stringify({ subtype: 'error_max_budget_usd' })).record.budgetHit).toBe(true);
    expect(parseEnvelope('').record).toMatchObject({ totalTokens: 0, terminalReason: 'no envelope' });
  });

  it('starts another area only while the running areas and it fit under the dollar cap', () => {
    const cap = 80;
    expect(mayStartArea({ used: 0, finished: [], inFlight: 0, cap, guess: 10 })).toBe(true);
    expect(mayStartArea({ used: 0, finished: [], inFlight: 7, cap, guess: 10 })).toBe(true);
    expect(mayStartArea({ used: 0, finished: [], inFlight: 8, cap, guess: 10 })).toBe(false);
    expect(mayStartArea({ used: 60, finished: [8.8, 11.2], inFlight: 1, cap, guess: 100 })).toBe(true);
    expect(mayStartArea({ used: 71, finished: [8.8, 11.2], inFlight: 0, cap, guess: 0 })).toBe(false);
  });
});

describe('appendRecordRow', () => {
  it('adds the row after the last row of the Record table', () => {
    const doc = '# H\n\n## Record\n\n| a |\n|---|\n| 1 |\n\nAfter.\n';
    expect(appendRecordRow(doc, '| 2 |')).toBe('# H\n\n## Record\n\n| a |\n|---|\n| 1 |\n| 2 |\n\nAfter.\n');
  });
});

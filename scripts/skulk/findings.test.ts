import { describe, expect, it } from 'vitest';
import { citedPaths, firstJson, fixTallyOf, isFinished, reportItems, parseFilesRead, parseFindings, reviewText, validPairs } from './findings.mjs';
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

describe('fixTallyOf', () => {
  it('counts its verdicts over the fixer\'s own tally line, which it reads only when no verdict parses', () => {
    expect(fixTallyOf('fixed 1a2b3c4d | a thing (A)\nChecks: pass\ntally: 3 of 4 fixed, 1 extra fixed\n')).toEqual({ fixed: 1, of: 1, extra: 0 });
    expect(fixTallyOf('Checks: pass\n\ntally: 3 of 4 fixed, 1 extra fixed\n')).toEqual({ fixed: 3, of: 4, extra: 1 });
    expect(fixTallyOf('A note about a watcher; nothing was lost.')).toBeNull();
  });

  it('counts a finding the fixer answers twice once', () => {
    const report = [
      'pathCrossings missed a cubic crossing itself (A): fixed 56f1699ac2',
      'pathCrossings never tested a segment against itself (B): duplicate of A\'s pathCrossings finding, fixed 56f1699ac2',
      'lengthTable gave 0 on overflow (A): fixed e1d05887c0',
      '', 'Extra:', 'lengths disagreed in the last bit: fixed a769170623', '', 'tally: 3 of 4 fixed, 0 extra fixed',
    ].join('\n');
    expect(fixTallyOf(report)).toEqual({ fixed: 2, of: 2, extra: 1 });
  });

  it('counts a report with no tally from its verdict lines, extras apart and checks left out', () => {
    const report = [
      'fixed 1a2b3c4d | a thing (A)', 'not a defect (it is documented) | another (B)', 'fixed 5e6f7a8b | a third (A+B)',
      'Extra defects found while fixing:', 'fixed 9c0d1e2f | an extra (sweep)', 'Checks:', '- vitest: fixed 3 files, pass',
    ].join('\n');
    expect(fixTallyOf(report)).toEqual({ fixed: 2, of: 3, extra: 1 });
  });
});

describe('reportItems', () => {
  it('reads what was broken and what the fix changed from either way a fixer writes a line', () => {
    const report = [
      'Held routes go stale after undo (A+B): fixed b34f6924a4. The pass now drops them on every write.',
      'fixed 1ed6ba02a9 | **A level drag commits nothing** (A). The commit check now tests the preview\'s extent.',
      '- Make Boolean Group doesn\'t strip page structure (B): not a defect. `rootsAmong` already does.',
      'Extra defects found while fixing:', '- `createSpecHops` made edges hop over hidden specs (sweep): fixed 8cd35da9bf',
      'Checks:', '- vitest: pass',
    ].join('\n');
    expect(reportItems(report)).toEqual([
      { claim: 'Held routes go stale after undo', from: 'A+B', verdict: 'fixed', note: 'The pass now drops them on every write.' },
      { claim: 'A level drag commits nothing', from: 'A', verdict: 'fixed', note: 'The commit check now tests the preview\'s extent.' },
      { claim: 'Make Boolean Group doesn\'t strip page structure', from: 'B', verdict: 'not a defect', note: '`rootsAmong` already does.' },
      { claim: '`createSpecHops` made edges hop over hidden specs', from: 'extra', verdict: 'fixed', note: '' },
    ]);
  });
});

describe('usage', () => {
  it('weights each kind of token by its price against an input token, one-hour cache writes at twice an input token', () => {
    const { record } = parseEnvelope(JSON.stringify({
      usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 300, cache_read_input_tokens: 0, cache_creation: { ephemeral_1h_input_tokens: 100, ephemeral_5m_input_tokens: 200 } },
    }));
    expect(record.weightedTokens).toBe(450);
  });

  it('weights every kind of token in an envelope and flags a job stopped by its dollar ceiling', () => {
    const { reply, record } = parseEnvelope(JSON.stringify({
      result: 'ok', total_cost_usd: 1.5, duration_ms: 900, terminal_reason: 'completed', subtype: 'success',
      usage: { input_tokens: 2, output_tokens: 10, cache_creation_input_tokens: 100, cache_read_input_tokens: 1000 },
      modelUsage: { 'claude-x': { costUSD: 1.5 } },
    }));
    expect(reply).toBe('ok');
    expect(record).toMatchObject({ weightedTokens: 277, costUsd: 1.5, models: ['claude-x'], budgetHit: false });
    expect(parseEnvelope(JSON.stringify({ subtype: 'error_max_budget_usd' })).record.budgetHit).toBe(true);
    expect(parseEnvelope('').record).toMatchObject({ weightedTokens: 0, terminalReason: 'no envelope' });
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

describe('reviewText', () => {
  it('counts a report as finished only once it has the done line', () => {
    expect(isFinished('## a')).toBe(false);
    expect(isFinished('## a\n<!-- done: 1 findings, files read: 3 -->')).toBe(true);
  });

  const done = '## a\n\n## Files read\n- x.ts\n\n<!-- done: 1 findings, files read: 1 -->';
  it('takes the reply when the file was written before the reviewer finished', () => {
    expect(reviewText('## a (early)', done)).toBe(done);
  });
  it('takes a finished file over the reply that only echoes its done line', () => {
    expect(reviewText(done, '<!-- done: 1 findings, files read: 1 -->')).toBe(done);
  });
  it('keeps an unfinished file over a reply holding only the done line', () => {
    expect(reviewText('## a\n## b', '<!-- done: 2 findings -->')).toBe('## a\n## b');
  });
  it('takes the reply when there is no file', () => {
    expect(reviewText('', 'partial reply')).toBe('partial reply');
  });
});

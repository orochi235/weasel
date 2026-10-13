import { describe, it, expect, beforeEach } from 'vitest';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { layoutAndPaint } from './testing/layoutAndPaint';
import { stubFetch, registerFixture, RUN_PLAIN } from './testing/fontFixtures';

beforeEach(() => {
  _resetFontRegistryForTests();
  stubFetch();
});

describe('layoutRuns — word wrap', () => {
  it('wraps a single run at space boundaries when content exceeds maxWidth', async () => {
    await registerFixture('inter', [{}]);
    // Fixture font has only 'A' (xadvance ~23 at size 32). Use width that
    // forces at least one wrap for the text below.
    const text = 'ABAB ABAB ABAB ABAB';
    const out = layoutAndPaint(
      [RUN_PLAIN(text)],
      { maxWidth: 150, lineHeight: 1.2, align: 'left' },
    );
    const quads = out.groups[0].quads;
    expect(quads.length).toBeGreaterThan(4);
    const firstY = quads[0].y0;
    const lastY = quads[quads.length - 1].y0;
    expect(lastY).toBeGreaterThan(firstY);
  });

  it('respects newlines inside a run as forced line breaks', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutAndPaint(
      [RUN_PLAIN('A\nB')],
      { maxWidth: Infinity, lineHeight: 1.2, align: 'left' },
    );
    const quads = out.groups[0].quads;
    expect(quads).toHaveLength(2);
    expect(quads[1].y0).toBeGreaterThan(quads[0].y0);
  });
});

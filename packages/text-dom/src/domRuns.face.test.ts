import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveTextStyle } from '@weasel-js/text';

const cssFontFamily = vi.hoisted(() => vi.fn((family: string) => family));
vi.mock('@weasel-js/font', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@weasel-js/font')>()),
  cssFontFamily,
}));

const { runsToDom } = await import('./domRuns');

describe('domRuns — a run naming its own family', () => {
  beforeEach(() => {
    cssFontFamily.mockClear();
  });

  it("asks for the face in the node's weight and style when the run sets neither", () => {
    const base = resolveTextStyle({ fontWeight: 700, fontStyle: 'italic' });
    runsToDom([{ text: 'a', fontFamily: 'Serif X' }], document.createElement('div'), base);
    expect(cssFontFamily).toHaveBeenCalledWith('Serif X', 700, 'italic');
  });

  it("asks for the run's own weight over the node's", () => {
    const base = resolveTextStyle({ fontWeight: 700 });
    runsToDom([{ text: 'a', fontFamily: 'Serif X', fontWeight: 300 }], document.createElement('div'), base);
    expect(cssFontFamily).toHaveBeenCalledWith('Serif X', 300, 'normal');
  });
});

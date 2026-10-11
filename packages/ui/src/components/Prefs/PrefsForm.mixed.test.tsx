import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefsForm, type PrefRenderContext } from './index';

afterEach(cleanup);

const SCHEMA: PrefGroup = {
  name: 'Prefs',
  children: {
    title: { kind: 'string', name: 'Title', description: '', default: 'x' },
    odd: { kind: 'odd', name: 'Odd', description: '', default: 1 } as never,
  },
};

describe('PrefsForm with mixed values', () => {
  it('hands a custom renderer mixed and no value at a mixed path', () => {
    const seen: PrefRenderContext[] = [];
    render(<PrefsForm schema={SCHEMA} values={{ title: 'a', odd: 3 }} onChange={vi.fn()} layout="list"
      mixed={new Set(['odd'])} renderers={{ odd: (ctx) => { seen.push(ctx); return <span>odd</span>; } }} />);
    expect(seen.at(-1)).toMatchObject({ mixed: true, value: undefined });
  });

  it('says a path outside the set is not mixed', () => {
    const seen: PrefRenderContext[] = [];
    render(<PrefsForm schema={SCHEMA} values={{ odd: 3 }} onChange={vi.fn()} layout="list"
      renderers={{ odd: (ctx) => { seen.push(ctx); return <span>odd</span>; } }} />);
    expect(seen.at(-1)).toMatchObject({ mixed: false, value: 3 });
  });

  it('draws a built-in text control empty at a mixed path', () => {
    render(<PrefsForm schema={SCHEMA} values={{ title: 'a' }} onChange={vi.fn()} layout="list" mixed={new Set(['title'])} />);
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('');
  });
});

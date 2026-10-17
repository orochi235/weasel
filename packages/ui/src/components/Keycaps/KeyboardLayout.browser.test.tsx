import '@weasel-js/theme/tokens.css';
import '@weasel-js/theme/faces.css';
import { Profiler, StrictMode, type ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup } from '@testing-library/react';
import { KeyBank } from './KeyBank';
import { KeyCap } from './Keycap';
import { KeyboardLayouts } from './KeyboardLayout.stories';
import KeyBankStories, { Default as BankDefault, Wrapped as BankWrapped } from './KeyBank.stories';
import { renderWithIcons } from '../../testing/withIcons';

afterEach(cleanup);

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Renders `node` with a web font that loads only once the keys ask for it,
 *  and returns the window errors raised and the commits made after it should
 *  have settled. */
async function settle(node: ReactNode): Promise<{ errors: string[]; lateCommits: number; root: HTMLElement }> {
  const errors: string[] = [];
  const onError = (e: ErrorEvent) => { errors.push(e.message); e.preventDefault(); };
  window.addEventListener('error', onError);
  let commits = 0;
  try {
    const { container } = renderWithIcons(<Profiler id="probe" onRender={() => { commits++; }}>{node}</Profiler>);
    await document.fonts.ready;
    await wait(300);
    const settled = commits;
    await wait(500);
    return { errors, lateCommits: commits - settled, root: container };
  } finally {
    window.removeEventListener('error', onError);
  }
}

describe('KeyboardLayouts story', () => {
  it('settles with a web font loading, raising no ResizeObserver loop', async () => {
    const { errors, lateCommits } = await settle(
      KeyboardLayouts.render!({ legend: 'auto', font: 'oswald', wrap: true } as never, {} as never),
    );
    expect(document.fonts.check("300 13px 'Oswald'")).toBe(true);
    expect(errors).toEqual([]);
    expect(lateCommits).toBe(0);
  });
});

describe('a bank of content-sized keys', () => {
  it('prints each key\'s first spelling and settles, raising no ResizeObserver loop', async () => {
    const { errors, lateCommits, root } = await settle(
      <KeyBank wrap>
        {['Insert', 'Backspace', 'PgUp', 'Home'].map((k) => <KeyCap key={k} label={k} font="'Oswald', sans-serif" />)}
      </KeyBank>,
    );
    expect(errors).toEqual([]);
    expect(lateCommits).toBe(0);
    expect([...root.querySelectorAll('kbd')].map((k) => k.textContent)).toEqual(['Insert', 'Backspace', 'PgUp', 'Home']);
  });
});

describe('the KeyBank stories', () => {
  it.each([['Default', BankDefault], ['Wrapped', BankWrapped]])('%s settles under StrictMode, raising no ResizeObserver loop', async (_name, story) => {
    const args = { ...KeyBankStories.args, ...story.args, font: 'oswald' };
    const { errors, lateCommits, root } = await settle(
      <StrictMode>{KeyBankStories.render!(args as never, {} as never)}</StrictMode>,
    );
    expect(root.querySelectorAll('kbd')).toHaveLength(9);
    expect(errors).toEqual([]);
    expect(lateCommits).toBe(0);
  });
});

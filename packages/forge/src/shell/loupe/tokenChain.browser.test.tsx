import './tokenChain.browser.test.css';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LENS_DEFAULTS, type LensIds, type LensSettings, type LensSource } from '@weasel-js/labkit/loupe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOverrides } from '../../frame/cssVars';
import { subscribeReveal } from '../cssVars/reveal';
import { scopeOf } from '../hostConditions';
import type { ForgeComparison } from './conditions';
import { NEEDS_LIVE, TokenReadout } from './readouts';
import { type ColorAt, colorAt, INLINE, tokenChain } from './tokenChain';

// jsdom resolves no var() and lays nothing out, so where a color comes from is a real browser's question.

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

/** A story host holding a box and a line of text, its host id `fg-tc`. */
function story(attrs = ''): HTMLElement {
  document.body.insertAdjacentHTML(
    'beforeend',
    `<div class="fg-tc-root" data-fg-host="fg-tc" ${attrs}><div class="fg-tc-box"></div><p class="fg-tc-text">Hello</p></div>`,
  );
  return document.querySelector('.fg-tc-root') as HTMLElement;
}

const centerOf = (el: Element | Range) => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

function boxColor(root: HTMLElement): ColorAt {
  const at = colorAt(centerOf(root.querySelector('.fg-tc-box')!), root);
  expect(at).not.toBeNull();
  return at!;
}

describe('tokenChain', () => {
  it('follows background-color through two tokens to a literal', () => {
    const at = boxColor(story());
    expect(at).toMatchObject({ property: 'background-color', value: 'rgb(245, 245, 246)' });
    const chain = tokenChain(at);
    expect(chain.map((l) => l.property)).toEqual(['background-color', '--wzl-bg', '--wzl-gray-50']);
    expect(chain.map((l) => l.declared)).toEqual(['var(--wzl-bg)', 'var(--wzl-gray-50)', '#f5f5f6']);
    expect(chain[1]?.selector).toBe('.fg-tc-root');
  });

  it('takes the dark block’s declaration under data-wzl-mode="dark"', () => {
    const at = boxColor(story('data-wzl-mode="dark"'));
    expect(at.value).toBe('rgb(24, 24, 27)');
    const chain = tokenChain(at);
    expect(chain.map((l) => l.property)).toEqual(['background-color', '--wzl-bg', '--wzl-gray-900']);
    expect(chain[1]?.selector).toBe('.fg-tc-root[data-wzl-mode="dark"]');
  });

  it('takes a vars-panel override over the stylesheet', () => {
    const root = story();
    const overrides = createOverrides(document, scopeOf('fg-tc'));
    try {
      overrides.set('--wzl-bg', '#abcdef');
      const at = boxColor(root);
      expect(at.value).toBe('rgb(171, 205, 239)');
      const chain = tokenChain(at);
      expect(chain.map((l) => [l.property, l.declared])).toEqual([
        ['background-color', 'var(--wzl-bg)'],
        ['--wzl-bg', '#abcdef'],
      ]);
      expect(chain[1]?.element).toBe(root);
    } finally {
      overrides.dispose();
    }
  });

  it('reads the text under the point by its color, through its token', () => {
    const root = story();
    const range = document.createRange();
    range.selectNodeContents(root.querySelector('.fg-tc-text')!.firstChild!);
    const at = colorAt(centerOf(range), root);
    expect(at).toMatchObject({ property: 'color', element: root.querySelector('.fg-tc-text') });
    expect(tokenChain(at!).map((l) => l.property)).toEqual(['color', '--wzl-fg', '--wzl-gray-900']);
  });

  it('takes an inline declaration over every rule', () => {
    const root = story();
    root.querySelector<HTMLElement>('.fg-tc-box')!.style.setProperty('background-color', 'var(--wzl-gray-900)');
    const chain = tokenChain(boxColor(root));
    expect(chain.map((l) => [l.property, l.selector])).toEqual([
      ['background-color', INLINE],
      ['--wzl-gray-900', '.fg-tc-root'],
    ]);
  });

  it('finds no color where nothing inside the host is under the point', () => {
    const root = story();
    expect(colorAt({ x: 5, y: 5 }, root)).toBeNull();
  });
});

const IDS = { lensId: 'a', body: 'a:body', reticle: 'a:reticle', leader: 'a:leader' } as LensIds;

function source(kind: 'live' | 'pixels'): LensSource<ForgeComparison> {
  return {
    kind,
    produces: kind === 'live' ? 'dom' : 'pixels',
    label: () => kind,
    status: () => true,
    subscribe: () => () => {},
    attach: () => ({ update() {}, detach() {} }),
  };
}

function mountReadout(settings: Partial<LensSettings<ForgeComparison>>, kind: 'live' | 'pixels', reticle: { x: number; y: number }) {
  return render(
    <TokenReadout
      lens={IDS}
      settings={{ ...LENS_DEFAULTS, source: kind, ...settings }}
      sources={{ [kind]: source(kind) }}
      reticle={reticle}
      size={{ width: 160, height: 160 }}
      describe={String}
    />,
  );
}

describe('TokenReadout', () => {
  it('lists the chain under the aim, and a token in it opens the CSS vars panel at that token', () => {
    const root = story();
    mountReadout({}, 'live', centerOf(root.querySelector('.fg-tc-box')!));
    const readout = document.querySelector('.fg-lens-token')!;
    expect(readout.textContent).toBe('background-color ← --wzl-bg ← --wzl-gray-50 ← #f5f5f6');
    const asked = vi.fn();
    const off = subscribeReveal(asked);
    try {
      fireEvent.click(screen.getByRole('button', { name: '--wzl-bg' }));
      expect(asked).toHaveBeenCalledWith('--wzl-bg');
    } finally {
      off();
    }
  });

  it('reads the main story through a Pixels lens that changes nothing', () => {
    const root = story();
    mountReadout({}, 'pixels', centerOf(root.querySelector('.fg-tc-box')!));
    expect(document.querySelector('.fg-lens-token')!.textContent).toContain('--wzl-gray-50');
  });

  it('says it needs a Live source over a Pixels capture of changed conditions', () => {
    const root = story();
    mountReadout({ compare: { kind: 'opposite-mode' } }, 'pixels', centerOf(root.querySelector('.fg-tc-box')!));
    expect(document.querySelector('.fg-lens-token')!.textContent).toBe(NEEDS_LIVE);
    expect(NEEDS_LIVE).toBe('Token needs a Live source for changed conditions');
  });
});

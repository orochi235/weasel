import { afterEach, describe, expect, it, vi } from 'vitest';
import { documentSheets, tokensReadAt } from './inspect';

describe('tokensReadAt', () => {
  afterEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('skips the rules of a media query the page does not match', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('min-width') }));
    document.head.innerHTML = `<style>
      @media (prefers-color-scheme: dark) { .btn { color: var(--wzl-fg-dark); } }
      @media (min-width: 1px) { .btn { color: var(--wzl-fg-wide); } }
    </style>`;
    document.body.innerHTML = '<div class="pane"><button class="btn" id="t">x</button></div>';
    expect(tokensReadAt(document.getElementById('t')!, document.querySelector('.pane')!, documentSheets())).toEqual(['fg-wide']);
  });

  it('collects the tokens rules matching the element and its ancestors read, up to the pane', () => {
    document.head.innerHTML = `<style>
      .pane { background-color: var(--wzl-surface); }
      .btn { color: var(--wzl-fg); background-color: var(--wzl-accent); }
      .panel { --wzl-local: var(--wzl-gray-100); padding-top: var(--wzl-space-md); }
      .elsewhere { color: var(--wzl-danger); }
    </style>`;
    document.body.innerHTML = '<div class="pane"><div class="panel"><button class="btn"><span id="t">x</span></button></div></div>';
    const target = document.getElementById('t')!;
    const pane = document.querySelector('.pane')!;
    expect(tokensReadAt(target, pane, documentSheets())).toEqual(['fg', 'accent', 'space-md']);
  });

  it('follows a private custom property a real declaration reads to the tokens it holds', () => {
    document.head.innerHTML = `<style>
      .btn { --btn-radius: var(--wzl-button-radius); --btn-unused: var(--wzl-danger); border-radius: var(--btn-radius); }
      .pane .btn { --wzl-fg-muted: var(--wzl-fg-muted-on-accent); color: var(--wzl-fg-muted); }
    </style>`;
    document.body.innerHTML = '<div class="pane"><button class="btn" id="t">x</button></div>';
    const target = document.getElementById('t')!;
    expect(tokensReadAt(target, document.querySelector('.pane')!, documentSheets())).toEqual(['button-radius', 'fg-muted', 'fg-muted-on-accent']);
  });
});

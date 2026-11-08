import { afterEach, describe, expect, it } from 'vitest';
import { usedCssVars } from './cssVarUse';

const added: Element[] = [];
afterEach(() => {
  for (const el of added.splice(0)) el.remove();
});

function addStyle(css: string): void {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
  added.push(style);
}

/** A story root holding `html`, inside a wrapper standing for the page around it. */
function mount(html: string): HTMLElement {
  const page = document.createElement('div');
  page.className = 't-page';
  const root = document.createElement('div');
  root.className = 't-root';
  root.innerHTML = html;
  page.append(root);
  document.body.append(page);
  added.push(page);
  return root;
}

const tVars = (set: Set<string>) => [...set].filter((name) => name.startsWith('--t-')).sort();

describe('usedCssVars', () => {
  it('counts a var read by a rule matching an element in the story, and not one whose rule matches nothing', () => {
    addStyle('.t-chip { color: var(--t-chip); } .t-absent { color: var(--t-absent); }');
    const root = mount('<span class="t-chip"></span>');
    expect(tVars(usedCssVars(document, root))).toEqual(['--t-chip']);
  });

  it('follows a used var through the definitions that reach the story, an ancestor’s included', () => {
    addStyle(
      '.t-page { --t-fg: var(--t-ink); --t-ink: var(--t-base); --t-spare: var(--t-unread); } ' +
        '.t-chip { color: var(--t-fg); } .t-elsewhere { --t-base: var(--t-wrong); }',
    );
    const root = mount('<span class="t-chip"></span>');
    expect(tVars(usedCssVars(document, root))).toEqual(['--t-base', '--t-fg', '--t-ink']);
  });

  it('follows a definition held in an adopted sheet, where a theme writes its tokens', () => {
    addStyle('.t-chip { color: var(--t-fg); }');
    const sheet = new CSSStyleSheet();
    sheet.replaceSync('.t-page { --t-fg: var(--t-theme-ink); }');
    // jsdom has no adoptedStyleSheets of its own.
    Object.defineProperty(document, 'adoptedStyleSheets', { value: [sheet], configurable: true });
    try {
      expect(tVars(usedCssVars(document, mount('<span class="t-chip"></span>')))).toEqual(['--t-fg', '--t-theme-ink']);
    } finally {
      delete (document as { adoptedStyleSheets?: unknown }).adoptedStyleSheets;
    }
  });

  it('does not count what an ancestor’s own declarations read', () => {
    addStyle('.t-page { color: var(--t-page-ink); }');
    expect(tVars(usedCssVars(document, mount('<span></span>')))).toEqual([]);
  });

  it('counts a rule that applies only on hover, focus, or to a pseudo-element', () => {
    addStyle(
      '.t-chip:hover { color: var(--t-hover); } .t-chip:focus-visible { outline-color: var(--t-ring); } ' +
        '.t-chip::before { content: ""; color: var(--t-mark); }',
    );
    const root = mount('<span class="t-chip"></span>');
    expect(tVars(usedCssVars(document, root))).toEqual(['--t-hover', '--t-mark', '--t-ring']);
  });

  it('reads rules inside @media, and inline styles in the story', () => {
    addStyle('@media (min-width: 1px) { .t-chip { color: var(--t-media); } }');
    const root = mount('<span class="t-chip" style="--t-own: var(--t-deep); margin: var(--t-own)"></span>');
    expect(tVars(usedCssVars(document, root))).toEqual(['--t-deep', '--t-media', '--t-own']);
  });
});

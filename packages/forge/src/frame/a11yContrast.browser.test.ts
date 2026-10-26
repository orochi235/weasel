import { afterEach, describe, expect, it } from 'vitest';
import type { A11yReport } from '../protocol/messages';
import { runAxe } from './a11y';

// axe's color-contrast rule reads layout and paint order, so only a real browser can show what it decides.

const STYLE = `
.chrome { position: relative; width: 600px; padding: 24px; background: rgb(24, 26, 30); }
.chrome::before {
  content: ''; position: absolute; inset: 0; z-index: 0; pointer-events: none;
  background-image: radial-gradient(1px 1px at 4% 18%, #fff, transparent 60%);
}
.chrome > canvas { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 2; pointer-events: none; }
.story { position: relative; z-index: 1; padding: 8px; background: rgb(24, 26, 30); font-size: 14px; }
.story p { margin: 4px 0; }
.covered { position: relative; }
.covered > span { position: absolute; inset: 0; }
`;

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const fn of cleanups.splice(0)) fn();
});

/** A story's root inside workshop chrome that paints over it (a canvas) and behind it (a pseudo element). */
function mount(storyHtml: string): HTMLElement {
  const style = document.createElement('style');
  style.textContent = STYLE;
  const chrome = document.createElement('div');
  chrome.className = 'chrome';
  chrome.innerHTML = `<div class="story">${storyHtml}</div><canvas></canvas>`;
  document.head.append(style);
  document.body.append(chrome);
  cleanups.push(() => {
    chrome.remove();
    style.remove();
  });
  return chrome.querySelector('.story')!;
}

const contrastNodes = (findings: A11yReport['violations']) =>
  findings.find((f) => f.id === 'color-contrast')?.nodes ?? [];
const targets = (findings: A11yReport['violations']) => contrastNodes(findings).map((n) => n.target.join(' '));

describe('runAxe color contrast inside workshop chrome', () => {
  it('decides text that axe gave up on only because of chrome outside the audited element', async () => {
    const root = mount('<p id="ok" style="color: rgb(230, 231, 233)">Readable text</p><p id="low" style="color: rgb(60, 62, 66)">Dim text</p>');
    const report = await runAxe(root, { page: false });
    expect(targets(report.incomplete)).not.toContain('#ok');
    expect(targets(report.incomplete)).not.toContain('#low');
    expect(targets(report.violations)).toEqual(['#low']);
    expect(contrastNodes(report.violations)[0]!.failureSummary).toMatch(/1\.\d\d:1/);
  }, 20_000);

  it('leaves text covered by part of the story itself for review, under that reason rather than the chrome’s', async () => {
    const root = mount('<p id="inner" class="covered" style="color: rgb(230, 231, 233)">Covered text<span></span></p>');
    const report = await runAxe(root, { page: false });
    const node = contrastNodes(report.incomplete).find((n) => n.target.join(' ') === '#inner');
    expect(node?.reason?.key).toBe('bgOverlap');
  }, 20_000);
});

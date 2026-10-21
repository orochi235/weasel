import './canvas-kit-demo.css';
import './typography.css';
import { afterEach, expect, test } from 'vitest';

// The site's spacing and chrome colors come from --wzl-* tokens, which only a browser resolves.

let el: HTMLElement | undefined;
afterEach(() => {
  el?.remove();
  document.documentElement.removeAttribute('data-wzl-mode');
});

function styled(className: string): CSSStyleDeclaration {
  el = document.createElement('div');
  el.className = className;
  document.body.append(el);
  return getComputedStyle(el);
}

/** A computed color's lightness, 0 to 1, as the mean of its channels. */
function lightness(color: string): number {
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return (r + g + b) / (3 * 255);
}

test('a rung in the site stylesheet resolves to the px it replaced', () => {
  expect(styled('ckd-sidebar').padding).toBe('20px 16px 32px');
  expect(styled('ckd-nav').rowGap).toBe('14px');
});

test.each([
  ['dark', (page: number, text: number) => page < 0.3 && text > 0.7],
  ['light', (page: number, text: number) => page > 0.7 && text < 0.3],
] as const)('the page and the sidebar follow %s mode', (mode, reads) => {
  document.documentElement.setAttribute('data-wzl-mode', mode);
  const body = getComputedStyle(document.body);
  expect(reads(lightness(body.backgroundColor), lightness(body.color))).toBe(true);
  const sidebar = styled('ckd-sidebar');
  expect(reads(lightness(sidebar.backgroundColor), lightness(body.color))).toBe(true);
});

test('the active nav link sets its text in the color made for an accent fill', () => {
  el = document.createElement('nav');
  el.className = 'ckd-nav-section';
  el.innerHTML = '<a class="active">Scene</a><span>probe</span>';
  document.body.append(el);
  const probe = el.querySelector('span')!;
  probe.style.color = 'var(--wzl-fg-on-accent)';
  expect(getComputedStyle(el.querySelector('a')!).color).toBe(getComputedStyle(probe).color);
});

test('running text is set in the body face, and headings and chrome in Oswald', () => {
  el = document.createElement('div');
  el.innerHTML = '<aside class="ckd-sidebar"><a>Scene</a></aside>'
    + '<main class="ckd-main"><h2>Title</h2><p>Prose.</p><div class="ckd-canvas-wrap"><span class="ckd-hint">Hint</span></div></main>';
  document.body.append(el);
  const face = (selector: string) => getComputedStyle(el!.querySelector(selector)!).fontFamily.split(',')[0];
  expect(face('main p')).toBe('Inter');
  expect(face('.ckd-hint')).toBe('Inter');
  expect(face('main h2')).toBe('Oswald');
  expect(face('.ckd-sidebar a')).toBe('Oswald');
  expect(face('.ckd-canvas-wrap')).toBe('Oswald');
});

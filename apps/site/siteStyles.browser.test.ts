import './canvas-kit-demo.css';
import { afterEach, expect, test } from 'vitest';

// The site's spacing comes off the --wzl-space ladder, which only a browser resolves.

let el: HTMLElement | undefined;
afterEach(() => el?.remove());

function styled(className: string): CSSStyleDeclaration {
  el = document.createElement('div');
  el.className = className;
  document.body.append(el);
  return getComputedStyle(el);
}

test('a rung in the site stylesheet resolves to the px it replaced', () => {
  expect(styled('ckd-sidebar').padding).toBe('20px 16px 32px');
  expect(styled('ckd-nav').rowGap).toBe('14px');
});

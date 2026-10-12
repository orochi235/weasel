import '@weasel-js/theme/tokens.css';
import { afterEach, expect, test } from 'vitest';
import callout from './Callout/Callout.module.css';
import dialog from './Dialog/Dialog.module.css';
import listbox from './listbox.module.css';
import toast from './Toast/Toast.module.css';
import tooltip from './Tooltip/Tooltip.module.css';

// What an overlay's shadow and a dialog's scrim are drawn in is a var() chain,
// which jsdom leaves unresolved.

let host: HTMLElement | undefined;
afterEach(() => host?.remove());

function styled(className: string, tokens: Record<string, string>): CSSStyleDeclaration {
  host = document.createElement('div');
  for (const [name, value] of Object.entries(tokens)) host.style.setProperty(name, value);
  const el = document.createElement('div');
  el.className = className;
  host.append(el);
  document.body.append(host);
  return getComputedStyle(el);
}

test.each([
  ['a dialog', dialog.modal],
  ['an inline dialog', dialog.inline],
  ['a toast', toast.toast],
  ['a tooltip', tooltip.tooltip],
  ['a callout', callout.popover],
  ['a menu or picker popover', listbox.surface],
])('%s casts its shadow in the theme’s shadow color', (_, className) => {
  expect(styled(className, { '--wzl-shadow': 'rgb(1, 2, 3)' }).boxShadow).toContain('rgb(1, 2, 3)');
});

test('a dialog dims the page in the theme’s scrim color', () => {
  expect(styled(dialog.overlay, { '--wzl-scrim': 'rgb(4, 5, 6)' }).backgroundColor).toBe('rgb(4, 5, 6)');
});

test('the default scrim is black at 40%', () => {
  expect(styled(dialog.overlay, {}).backgroundColor).toBe('rgba(0, 0, 0, 0.4)');
});

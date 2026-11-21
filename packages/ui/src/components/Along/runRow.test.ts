import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, expect, test } from 'vitest';

afterEach(() => {
  document.head.replaceChildren();
  document.body.replaceChildren();
});

test('an item a scrolling run places under a list inside its root still takes a touch drag', () => {
  const style = document.createElement('style');
  style.textContent = readFileSync(resolve(__dirname, 'runRow.module.css'), 'utf8').replace(/composes:[^;]*;/g, '');
  document.head.append(style);
  const root = document.createElement('div');
  root.className = 'root';
  root.setAttribute('data-scrolls', '');
  const list = document.createElement('div');
  const direct = document.createElement('button');
  const nested = document.createElement('button');
  direct.className = nested.className = 'item';
  list.append(nested);
  root.append(direct, list);
  document.body.append(root);
  expect(getComputedStyle(direct).getPropertyValue('touch-action')).toBe('none');
  expect(getComputedStyle(nested).getPropertyValue('touch-action')).toBe('none');
});

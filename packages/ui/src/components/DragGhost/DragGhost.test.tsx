import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { DragGhost } from './DragGhost';

afterEach(() => { cleanup(); document.body.innerHTML = ''; });

it("places the ghost in its host's own px when the host draws its fixed boxes at twice their size", () => {
  document.body.innerHTML = '<div id="host" data-wzl-theme="x" style="transform: scale(2)"><i id="from"></i></div>';
  const host = document.getElementById('host')!;
  Object.defineProperty(host, 'offsetWidth', { value: 100 });
  Object.defineProperty(host, 'offsetHeight', { value: 50 });
  host.getBoundingClientRect = () => DOMRect.fromRect({ x: 40, y: 20, width: 200, height: 100 });
  render(<DragGhost at={{ left: 100, top: 60, width: 80 }} from={document.getElementById('from')!}>row</DragGhost>);
  const ghost = host.querySelector<HTMLElement>('[aria-hidden="true"]')!;
  expect([ghost.style.left, ghost.style.top, ghost.style.width]).toEqual(['30px', '20px', '40px']);
});

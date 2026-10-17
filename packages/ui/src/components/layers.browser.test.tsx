import '@weasel-js/theme/tokens.css';
import { cleanup, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { Dialog } from './Dialog/Dialog';
import { DragGhost } from './DragGhost/DragGhost';
import { renderWithIcons } from '../testing/withIcons';

// The overlays order themselves on the --wzl-z-* ladder; jsdom resolves no var().

afterEach(cleanup);

function Scene() {
  return (
    <Dialog isOpen onOpenChange={() => {}} title="Layers">
      <p>Body</p>
      <DragGhost at={{ left: 0, top: 0, width: 80 }} from={document.body}>
        <span data-testid="ghost-item">Row</span>
      </DragGhost>
    </Dialog>
  );
}

const zOf = (el: Element) => Number(getComputedStyle(el).zIndex);

function overlayOf(dialog: Element): Element {
  let el: Element | null = dialog;
  while (el && getComputedStyle(el).position !== 'fixed') el = el.parentElement;
  if (!el) throw new Error('no fixed overlay around the dialog');
  return el;
}

test('a drag ghost draws over an open dialog', () => {
  renderWithIcons(<Scene />);
  const overlay = overlayOf(screen.getByRole('dialog'));
  const ghost = screen.getByTestId('ghost-item').parentElement as Element;
  expect(zOf(ghost)).toBeGreaterThan(zOf(overlay));
});

test('retuning --wzl-z-modal moves the dialog', () => {
  document.documentElement.style.setProperty('--wzl-z-modal', '4321');
  try {
    renderWithIcons(<Scene />);
    expect(zOf(overlayOf(screen.getByRole('dialog')))).toBe(4321);
  } finally {
    document.documentElement.style.removeProperty('--wzl-z-modal');
  }
});

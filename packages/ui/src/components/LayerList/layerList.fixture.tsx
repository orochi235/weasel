import { fireEvent, screen } from '@testing-library/react';
import { afterAll, beforeAll } from 'vitest';
import { renderWithIcons } from '../../testing/withIcons';
import { LayerList, type LayerListItem, type LayerListProps } from './LayerList';

export const FLAT: LayerListItem[] = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Beta' },
  { id: 'c', label: 'Gamma' },
];

export const TREE: LayerListItem[] = [
  { id: 'g', label: 'Group', children: [{ id: 'g1', label: 'One' }, { id: 'g2', label: 'Two' }] },
  { id: 'b', label: 'Beta' },
];

export const BG: LayerListItem = { id: 'bg', label: 'Background', fixed: true };

export const ROW_H = 28;

/** The element a row is: a treegrid's row box, else a treeitem. */
export const row = (label: string) => screen.getByText(label).closest<HTMLElement>('[role="row"], [role="treeitem"]')!;

const isRowBox = (el: Element) =>
  el.getAttribute('role') === 'row' || el.parentElement?.getAttribute('role') === 'treeitem';

/** jsdom lays nothing out: stand each visible row's box `ROW_H` tall, in document order, all at one inline start. */
export function stampRows() {
  const realRect = Element.prototype.getBoundingClientRect;
  const realCapture = HTMLElement.prototype.setPointerCapture;
  beforeAll(() => {
    Element.prototype.getBoundingClientRect = function (this: Element) {
      if (!isRowBox(this)) return realRect.call(this);
      const all = Array.from(document.querySelectorAll('[role="row"], [role="treeitem"] > :first-child'));
      const i = all.indexOf(this);
      return { x: 0, y: i * ROW_H, top: i * ROW_H, left: 0, right: 200, bottom: (i + 1) * ROW_H, width: 200, height: ROW_H } as DOMRect;
    };
    HTMLElement.prototype.setPointerCapture = () => {};
  });
  afterAll(() => {
    Element.prototype.getBoundingClientRect = realRect;
    HTMLElement.prototype.setPointerCapture = realCapture;
  });
}

/** Presses `label`'s row at `fromY`, drags it to `toY`, and lets go. */
export function drag(label: string, toY: number, fromY = 0) {
  fireEvent.pointerDown(screen.getByText(label), { pointerId: 1, button: 0, isPrimary: true, clientX: 100, clientY: fromY });
  fireEvent.pointerMove(document, { pointerId: 1, clientX: 100, clientY: toY });
  fireEvent.pointerUp(document, { pointerId: 1, clientX: 100, clientY: toY });
}

export function click(label: string, init: { shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean } = {}) {
  fireEvent.click(screen.getByText(label), init);
}

export function list(props: Partial<LayerListProps> = {}) {
  return renderWithIcons(<LayerList items={FLAT} {...props} />);
}

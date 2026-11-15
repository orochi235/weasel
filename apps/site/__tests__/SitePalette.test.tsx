import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeAll, expect, it } from 'vitest';
import { SitePalette } from '../CommandPalette/SitePalette';
import { renderWithIcons } from '../testIcons';

afterEach(cleanup);
// jsdom has no layout, so no scrollIntoView; the palette calls it on every highlight.
beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

function Page() {
  return (
    <>
      <input aria-label="elsewhere" />
      <input type="checkbox" aria-label="toggle" />
      <span contentEditable suppressContentEditableWarning aria-label="prose">x</span>
      <SitePalette />
    </>
  );
}

const palette = () => screen.queryByRole('dialog', { name: 'Commands' });

it('opens on / and not while typing in a field', () => {
  renderWithIcons(<Page />);
  fireEvent.keyDown(screen.getByLabelText('elsewhere'), { key: '/', code: 'Slash' });
  expect(palette()).toBeNull();
  fireEvent.keyDown(document.body, { key: '/', code: 'Slash' });
  expect(palette()).not.toBeNull();
});

it('stays shut in editable text, and opens from a focused checkbox, which takes no typing', () => {
  renderWithIcons(<Page />);
  fireEvent.keyDown(screen.getByLabelText('prose'), { key: '/', code: 'Slash' });
  expect(palette()).toBeNull();
  fireEvent.keyDown(screen.getByLabelText('toggle'), { key: '/', code: 'Slash' });
  expect(palette()).not.toBeNull();
});

it('leaves / with Mod, Ctrl, or Alt to the browser, and opens on a layout that types / with Shift', () => {
  renderWithIcons(<Page />);
  for (const mod of ['metaKey', 'ctrlKey', 'altKey']) {
    fireEvent.keyDown(document.body, { key: '/', code: 'Slash', [mod]: true });
    expect(palette()).toBeNull();
  }
  fireEvent.keyDown(document.body, { key: '/', code: 'Digit7', shiftKey: true });
  expect(palette()).not.toBeNull();
});

it('lists its own command with the key that runs it', () => {
  renderWithIcons(<Page />);
  fireEvent.keyDown(document.body, { key: '/', code: 'Slash' });
  expect(screen.getByRole('option', { name: /Commands/ })).toBeTruthy();
});

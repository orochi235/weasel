import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, expect, it } from 'vitest';
import { tab } from '../MotifFrame/motifs';
import { PropertyGroup } from './PropertyGroup';
import { PropertyPanel } from './PropertyPanel';
import { Subpanel } from './Subpanel';

// `twisty="folded"` hides an open container's twisty until the keyboard reaches it. Whether the title
// stays where it was when the twisty shows is layout, which only a browser has.

afterEach(cleanup);

const CONTAINERS = [
  ['Subpanel', <Subpanel title="Fill" twisty="folded" collapsible>rows</Subpanel>],
  ['PropertyGroup', <PropertyGroup title="Fill" twisty="folded" collapsible>rows</PropertyGroup>],
  ['PropertyGroup in the tab motif', <PropertyGroup title="Fill" motif={tab()} twisty="folded" collapsible>rows</PropertyGroup>],
] as const;

it.each(CONTAINERS)('shows a hidden twisty under keyboard focus without moving the title of a %s', (_, container) => {
  render(container);
  const title = screen.getByText('Fill');
  const twisty = screen.getByRole('button', { name: /Fill/ });
  const before = title.getBoundingClientRect();
  expect(getComputedStyle(twisty).opacity).toBe('0');

  twisty.focus({ focusVisible: true } as FocusOptions);
  expect(twisty.matches(':focus-visible')).toBe(true);
  expect(getComputedStyle(twisty).opacity).toBe('1');
  const shown = twisty.getBoundingClientRect();
  expect(shown.width).toBeGreaterThanOrEqual(24);
  const after = title.getBoundingClientRect();
  expect(after.left).toBe(before.left);
  expect(after.top).toBe(before.top);
  expect(shown.right).toBeLessThanOrEqual(after.left);
});

// A panel's hidden twisty trails its header instead, and holds no room there.

function titleBox(panel: ReactElement) {
  const { container, unmount } = render(panel);
  const box = container.firstElementChild!.getBoundingClientRect();
  // The heading's line box: a panel that folds wraps its words in an inline span, whose own box is as
  // tall as whichever face drew them and sits higher or lower with it.
  const title = screen.getByText('Fill').closest('h2')!.getBoundingClientRect();
  unmount();
  return { left: title.left - box.left, top: title.top - box.top };
}

it('sets the title of a panel with a hidden twisty where a panel that does not fold has it', () => {
  const plain = titleBox(<PropertyPanel title="Fill" actions={<i />}>rows</PropertyPanel>);
  const open = titleBox(<PropertyPanel title="Fill" actions={<i />} twisty="folded" collapsible>rows</PropertyPanel>);
  const folded = titleBox(<PropertyPanel title="Fill" actions={<i />} twisty="folded" collapsed>rows</PropertyPanel>);
  expect(open).toEqual(plain);
  expect(folded).toEqual(plain);
});

it('shows a panel\'s hidden twisty at the end of its header under keyboard focus, moving nothing', () => {
  render(<PropertyPanel title="Fill" twisty="folded" collapsible>rows</PropertyPanel>);
  const title = screen.getByText('Fill');
  const twisty = screen.getByRole('button', { name: /Fill/ });
  const before = title.getBoundingClientRect();
  expect(getComputedStyle(twisty).opacity).toBe('0');

  twisty.focus({ focusVisible: true } as FocusOptions);
  expect(getComputedStyle(twisty).opacity).toBe('1');
  const shown = twisty.getBoundingClientRect();
  expect(shown.width).toBeGreaterThanOrEqual(24);
  const after = title.getBoundingClientRect();
  expect(after.left).toBe(before.left);
  expect(after.top).toBe(before.top);
  expect(shown.left).toBeGreaterThanOrEqual(after.right);
});

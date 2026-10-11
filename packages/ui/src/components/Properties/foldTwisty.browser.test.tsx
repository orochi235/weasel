import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { tab } from '../MotifFrame/motifs';
import { PropertyGroup } from './PropertyGroup';
import { PropertyPanel } from './PropertyPanel';
import { Subpanel } from './Subpanel';

// `twisty="folded"` hides an open container's twisty until the keyboard reaches it. Whether the title
// stays where it was when the twisty shows is layout, which only a browser has.

afterEach(cleanup);

const CONTAINERS = [
  ['PropertyPanel', <PropertyPanel title="Fill" twisty="folded" collapsible>rows</PropertyPanel>],
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

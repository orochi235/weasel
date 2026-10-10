import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PropertyGroup } from './PropertyGroup';
import { PropertyPanel } from './PropertyPanel';
import { Subpanel } from './Subpanel';

afterEach(cleanup);

describe('twisty="folded"', () => {
  it.each([
    ['PropertyPanel', <PropertyPanel key="p" title="Look" twisty="folded" collapsible><p>rows</p></PropertyPanel>],
    ['Subpanel', <Subpanel key="s" title="Look" twisty="folded" collapsible><p>rows</p></Subpanel>],
    ['PropertyGroup', <PropertyGroup key="g" title="Look" twisty="folded" collapsible><p>rows</p></PropertyGroup>],
  ])('%s hides its twisty while open, folds on a press of the title, and shows the twisty once folded', (_name, ui) => {
    render(ui);
    // jsdom applies no stylesheet, so the class is the proxy for "hidden".
    const twisty = () => screen.getByRole('button', { name: /Look/ });
    expect(twisty().className).toMatch(/foldTwistyQuiet/);
    expect(screen.getByText('rows')).toBeVisible();
    fireEvent.click(screen.getByText('Look'));
    expect(screen.getByText('rows')).not.toBeVisible();
    expect(twisty().className).not.toMatch(/foldTwistyQuiet/);
    fireEvent.click(twisty());
    expect(screen.getByText('rows')).toBeVisible();
  });

  it('keeps the twisty showing by default, and the title inert', () => {
    render(<PropertyPanel title="Look" collapsible><p>rows</p></PropertyPanel>);
    expect(screen.getByRole('button', { name: /Look/ }).className).not.toMatch(/foldTwistyQuiet/);
    fireEvent.click(screen.getByText('Look'));
    expect(screen.getByText('rows')).toBeVisible();
  });
});

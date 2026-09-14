import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ThemeDefinition } from '@weasel-js/theme';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deriveDraft } from '../theme/draft';
import { lookupOf, weasel } from '../theme/fixtures';
import { RampsLayer, type RampsLayerProps } from './RampsLayer';

function renderRamps(): RampsLayerProps & { onChange: ReturnType<typeof vi.fn> } {
  const lookup = lookupOf();
  const props = { draft: weasel, derived: deriveDraft(weasel, lookup, {}), lookup, highlight: [], focused: null, onFocus: vi.fn(), onChange: vi.fn() };
  render(<RampsLayer {...props} />);
  return props;
}
const nextDef = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls[0][0] as ThemeDefinition;

describe('<RampsLayer>', () => {
  afterEach(cleanup);

  it('shows the generated gray beneath the pinned one', () => {
    renderRamps();
    const gray = screen.getByRole('region', { name: 'gray ramp' });
    expect(within(gray).getByRole('rowheader', { name: 'Generated' })).toBeInTheDocument();
    expect(within(gray).getAllByText('#1a1c21').length).toBeGreaterThan(0);
  });

  it('unpins a step', async () => {
    const props = renderRamps();
    await userEvent.click(screen.getByRole('button', { name: 'Unpin gray-800' }));
    expect(nextDef(props.onChange).pins).not.toHaveProperty('gray-800');
  });

  it("asks before adopting weasel's generated ramp", async () => {
    const props = renderRamps();
    await userEvent.click(within(screen.getByRole('region', { name: 'gray ramp' })).getByRole('button', { name: 'Adopt generated' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(props.onChange).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Adopt' }));
    expect(Object.keys(nextDef(props.onChange).pins ?? {}).filter((n) => n.startsWith('gray-'))).toEqual([]);
  });

  it('opens the palette constraints in place for a categorical ramp', async () => {
    renderRamps();
    await userEvent.click(within(screen.getByRole('region', { name: 'swatch ramp' })).getByRole('button', { name: 'Edit gates' }));
    expect(screen.getByText('Min contrast')).toBeInTheDocument();
    expect(screen.queryByText('Colors')).toBeNull();
  });

  it("shows a ramp's own issues inside its section, and does not call authored values generated", () => {
    const broken = { ...weasel, ramps: { ...weasel.ramps!, accent: { ...weasel.ramps!.accent, chroma: { lightBias: 0.5 } } } } as unknown as ThemeDefinition;
    const lookup = lookupOf(broken);
    render(<RampsLayer draft={broken} derived={deriveDraft(broken, lookup, {})} lookup={lookup} highlight={[]} focused={null} onFocus={vi.fn()} onChange={vi.fn()} />);
    const accent = screen.getByRole('region', { name: 'accent ramp' });
    expect(within(accent).getByText(/ramps\.accent\.chroma\.peak: expected a number/)).toBeInTheDocument();
    expect(within(accent).queryByRole('rowheader', { name: 'Generated' })).toBeNull();
  });
});

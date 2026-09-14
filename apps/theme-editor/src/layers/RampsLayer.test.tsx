import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ThemeDefinition } from '@weasel-js/theme';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deriveDraft } from '../theme/draft';
import { child, lookupOf, weasel } from '../theme/fixtures';
import { adoptGenerated } from '../theme/model';
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

  it("keeps an inherited ramp read-only until it is made the theme's own", async () => {
    const lookup = lookupOf(child);
    const onChange = vi.fn();
    render(<RampsLayer draft={child} derived={deriveDraft(child, lookup, {})} lookup={lookup} highlight={[]} focused={null} onFocus={vi.fn()} onChange={onChange} />);
    const gray = screen.getByRole('region', { name: 'gray ramp' });
    expect(within(gray).queryAllByRole('slider')).toEqual([]);
    expect(within(gray).getByText(/pins it inherits on them stop applying/)).toBeInTheDocument();
    await userEvent.click(within(gray).getByRole('button', { name: "Make gray this theme's own" }));
    expect(nextDef(onChange).ramps?.gray).toBeDefined();
  });

  it('keeps Compare in preview on a focused ramp with no pins left', () => {
    const lookup = lookupOf();
    const adopted = adoptGenerated(weasel, lookup, 'gray');
    render(<RampsLayer draft={adopted} derived={deriveDraft(adopted, lookup, {})} lookup={lookup} highlight={[]} focused="gray" onFocus={vi.fn()} onChange={vi.fn()} />);
    const button = within(screen.getByRole('region', { name: 'gray ramp' })).getByRole('button', { name: 'Compare in preview' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it("pins each mode's own color", async () => {
    const tint = { kind: 'lightness', steps: ['a', 'b'], lightness: { by: 'mode', dark: [0.3, 0.5], light: [0.8, 0.6] }, hue: 200, chroma: { peak: 0.05 } };
    const draft = { ...weasel, ramps: { ...weasel.ramps!, tint } } as unknown as ThemeDefinition;
    const lookup = lookupOf(draft);
    const derived = deriveDraft(draft, lookup, {});
    const onChange = vi.fn();
    render(<RampsLayer draft={draft} derived={derived} lookup={lookup} highlight={[]} focused={null} onFocus={vi.fn()} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Pin tint-a' }));
    const hexIn = (mode: string) => derived.views.find((v) => v.mode === mode)!.result.tokens['tint-a'].value;
    expect(hexIn('dark')).not.toBe(hexIn('light'));
    expect(nextDef(onChange).pins?.['tint-a']).toEqual({
      by: 'mode',
      dark: { value: hexIn('dark'), type: 'color' },
      light: { value: hexIn('light'), type: 'color' },
    });
  });
});

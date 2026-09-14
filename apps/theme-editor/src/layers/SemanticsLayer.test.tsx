import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ThemeDefinition } from '@weasel-js/theme';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deriveDraft } from '../theme/draft';
import { lookupOf, weasel } from '../theme/fixtures';
import { setPin, setSemantic } from '../theme/model';
import { SemanticsLayer } from './SemanticsLayer';

function renderSemantics(def: ThemeDefinition) {
  const lookup = lookupOf(def);
  const onChange = vi.fn();
  render(<SemanticsLayer draft={def} derived={deriveDraft(def, lookup, {})} lookup={lookup} highlight={[]} onChange={onChange} />);
  return onChange;
}
const firstDef = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls[0][0] as ThemeDefinition;

describe('<SemanticsLayer>', () => {
  afterEach(cleanup);

  it('shows the step each mode ends on', () => {
    renderSemantics(weasel);
    const row = screen.getByRole('button', { name: 'surface' }).closest('tr')!;
    expect(within(row).getByText('gray-800')).toBeInTheDocument();
    expect(within(row).getByText('gray-50')).toBeInTheDocument();
  });

  it("opens a drawer with each mode's produced value and pin, and reverts the pin", async () => {
    const onChange = renderSemantics(setPin(weasel, 'fg', { value: '#ffffff', type: 'color' }));
    await userEvent.click(screen.getByRole('button', { name: 'fg' }));
    const drawer = screen.getByRole('complementary', { name: 'fg rule' });
    const dark = within(drawer).getByRole('rowheader', { name: 'dark' }).closest('tr')!;
    expect(within(dark).getByText('{gray-100}')).toBeInTheDocument();
    expect(within(dark).getByText('#ffffff')).toBeInTheDocument();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Revert pin' }));
    expect(firstDef(onChange).pins).not.toHaveProperty('fg');
  });

  it('stops a rule varying by mode, keeping the branch being edited', async () => {
    const onChange = renderSemantics(weasel);
    await userEvent.click(screen.getByRole('button', { name: 'surface' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Varies by mode' }));
    expect(firstDef(onChange).semantics!.surface).toEqual({ ref: 'gray-800', type: 'color' });
  });

  const drawerIssues = async (def: ThemeDefinition, name: string) => {
    renderSemantics(def);
    await userEvent.click(screen.getByRole('button', { name }));
    const drawer = screen.getByRole('complementary', { name: `${name} rule` });
    return within(within(drawer).getByRole('status'))
      .getAllByRole('listitem')
      .map((li) => li.textContent);
  };

  it("lists the contrast a semantic's rule cannot reach in its drawer", async () => {
    const def = setSemantic(weasel, 'fg-muted', { ramp: 'gray', contrast: { min: 21, against: ['surface'] } });
    expect(await drawerIssues(def, 'fg-muted')).toEqual([
      'fg-muted: no step reaches 21:1 against surface; using 50 at 15.99:1',
      'fg-muted: no step reaches 21:1 against surface; using 900 at 17.59:1',
    ]);
  });

  it("lists an issue on the semantic's path in its drawer", async () => {
    const def = setSemantic(weasel, 'fg-muted', { by: 'mode', dark: { ref: 'gray-300', type: 'color' } } as never);
    expect(await drawerIssues(def, 'fg-muted')).toEqual(['semantics.fg-muted has no value for mode=light']);
  });
});

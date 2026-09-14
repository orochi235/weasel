import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ThemeDefinition } from '@weasel-js/theme';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deriveDraft } from '../theme/draft';
import { lookupOf, spaced, weasel } from '../theme/fixtures';
import { ScalesLayer } from './ScalesLayer';

describe('<ScalesLayer>', () => {
  afterEach(cleanup);

  it('draws a ladder per scale with a column per density', () => {
    const lookup = lookupOf(spaced);
    render(<ScalesLayer draft={spaced} derived={deriveDraft(spaced, lookup, {})} lookup={lookup} highlight={[]} onChange={vi.fn()} />);
    const space = screen.getByRole('region', { name: 'space scale' });
    expect(within(space).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Step', 'density=comfortable', 'density=compact']);
    expect(within(space).getByText('7px')).toBeInTheDocument();
  });

  it('shows a parameter that varies by an axis as a note, not a slider', () => {
    const lookup = lookupOf(spaced);
    render(<ScalesLayer draft={spaced} derived={deriveDraft(spaced, lookup, {})} lookup={lookup} highlight={[]} onChange={vi.fn()} />);
    const space = screen.getByRole('region', { name: 'space scale' });
    expect(within(space).getAllByRole('slider')).toEqual([within(space).getByRole('slider', { name: 'Base' })]);
    expect(within(space).getByText(/"by":"density"/)).toBeInTheDocument();
  });

  it("keeps an inherited scale read-only until it is made the theme's own", async () => {
    const roomy: ThemeDefinition = { name: 'roomy', extends: 'spaced' };
    const lookup = lookupOf(spaced, roomy);
    const onChange = vi.fn();
    render(<ScalesLayer draft={roomy} derived={deriveDraft(roomy, lookup, {})} lookup={lookup} highlight={[]} onChange={onChange} />);
    const space = screen.getByRole('region', { name: 'space scale' });
    expect(within(space).queryAllByRole('slider')).toEqual([]);
    expect(within(space).getByText(/roomy inherits space/)).toBeInTheDocument();
    await userEvent.click(within(space).getByRole('button', { name: "Make space this theme's own" }));
    expect((onChange.mock.calls[0][0] as ThemeDefinition).scales?.space).toEqual(spaced.scales!.space);
  });

  it('says so when the theme has no scales', () => {
    const lookup = lookupOf();
    render(<ScalesLayer draft={weasel} derived={deriveDraft(weasel, lookup, {})} lookup={lookup} highlight={[]} onChange={vi.fn()} />);
    expect(screen.getByText('weasel has no scales.')).toBeInTheDocument();
  });
});

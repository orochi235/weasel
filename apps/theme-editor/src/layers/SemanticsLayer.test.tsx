import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ThemeDefinition } from '@weasel-js/theme';
import { useMemo, useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deriveDraft, type DerivedDraft } from '../theme/draft';
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
const lastDef = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls.at(-1)![0] as ThemeDefinition;

/** The Rule row is a weasel-ui `Select`, so it opens a listbox rather than being a
 *  native select. Its trigger is named "<current rule> Rule", hence the pattern. */
const ruleTrigger = () => screen.queryByRole('button', { name: /Rule$/ });
async function pickRule(option: string) {
  await userEvent.click(ruleTrigger()!);
  await userEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: option }));
}

/** Feeds each edit back in as the draft and, as the workbench does, keeps the last derivation that did not throw. */
function renderEditing(start: ThemeDefinition) {
  const onChange = vi.fn();
  function Harness() {
    const [draft, setDraft] = useState(start);
    const lookup = useMemo(() => lookupOf(draft), [draft]);
    const lastGood = useRef<DerivedDraft | null>(null);
    const derived = useMemo(() => {
      try {
        lastGood.current = deriveDraft(draft, lookup, {});
      } catch {
        // keep the last good one
      }
      return lastGood.current!;
    }, [draft, lookup]);
    return (
      <SemanticsLayer
        draft={draft}
        derived={derived}
        lookup={lookup}
        highlight={[]}
        onChange={(next, key, label) => {
          onChange(next, key, label);
          setDraft(next);
        }}
      />
    );
  }
  render(<Harness />);
  return onChange;
}

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

  it('shows what the draft holds while the draft does not derive', async () => {
    const onChange = renderEditing(weasel);
    await userEvent.click(screen.getByRole('button', { name: 'fg' }));
    const field = screen.getByRole('textbox', { name: 'Reference' });
    await userEvent.clear(field);
    await userEvent.type(field, 'gray-10');
    expect(() => deriveDraft(lastDef(onChange), lookupOf(lastDef(onChange)), {})).toThrow();
    expect(field).toHaveValue('gray-10');
  });

  it('keeps what is typed into Against and writes every name', async () => {
    const onChange = renderEditing(setSemantic(weasel, 'fg-muted', { ramp: 'gray', contrast: { min: 4.5, against: ['surface'] } }));
    await userEvent.click(screen.getByRole('button', { name: 'fg-muted' }));
    const field = screen.getByRole('textbox', { name: 'Against' });
    await userEvent.clear(field);
    await userEvent.type(field, 'surface, surface-raised');
    expect(field).toHaveValue('surface, surface-raised');
    expect(lastDef(onChange).semantics!['fg-muted']).toMatchObject({ contrast: { against: ['surface', 'surface-raised'] } });
  });

  it("starts a new rule that does not point at its own token", async () => {
    const onChange = renderSemantics(weasel);
    await userEvent.click(screen.getByRole('button', { name: 'surface' }));
    await pickRule('Offset');
    const next = firstDef(onChange);
    expect(() => deriveDraft(next, lookupOf(next), {})).not.toThrow();
  });

  const dense = (fgMuted: unknown): ThemeDefinition => ({
    ...weasel,
    axes: { ...weasel.axes, density: { default: 'comfortable', values: { comfortable: {}, compact: {} } } },
    semantics: { ...weasel.semantics, 'fg-muted': fgMuted as never },
  });

  it('reads a rule varying by any axis as varying, and keeps its branches on a kind change', async () => {
    const onChange = renderSemantics(
      dense({ by: 'density', comfortable: { ref: 'gray-300', type: 'color' }, compact: { ref: 'gray-400', type: 'color' } }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'fg-muted' }));
    expect(screen.getByRole('checkbox', { name: 'Varies by density' })).toBeChecked();
    expect(screen.getByRole('textbox', { name: 'Reference' })).toHaveValue('gray-300');
    await userEvent.click(within(screen.getByRole('group', { name: 'Editing' })).getByRole('button', { name: 'compact' }));
    expect(screen.getByRole('textbox', { name: 'Reference' })).toHaveValue('gray-400');
    await pickRule('Step');
    expect(firstDef(onChange).semantics!['fg-muted']).toMatchObject({
      by: 'density',
      comfortable: { ref: 'gray-300' },
      compact: { ramp: 'gray', step: '50' },
    });
  });

  it('shows a branch that itself varies as a note, not as fields', async () => {
    renderSemantics(
      dense({
        by: 'density',
        comfortable: { by: 'mode', dark: { ref: 'gray-300', type: 'color' }, light: { ref: 'gray-600', type: 'color' } },
        compact: { ref: 'gray-400', type: 'color' },
      }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'fg-muted' }));
    expect(screen.getByText('This branch varies by mode; edit it in the definition file.')).toBeInTheDocument();
    expect(ruleTrigger()).toBeNull();
  });

  it('opens on a branch the rule has, and adds a missing one', async () => {
    const light = { ref: 'gray-600', type: 'color' };
    const onChange = renderSemantics(setSemantic(weasel, 'fg-muted', { by: 'mode', light } as never));
    await userEvent.click(screen.getByRole('button', { name: 'fg-muted' }));
    const editing = screen.getByRole('group', { name: 'Editing' });
    expect(within(editing).getByRole('button', { name: 'light' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('textbox', { name: 'Reference' })).toHaveValue('gray-600');
    await userEvent.click(within(editing).getByRole('button', { name: 'dark' }));
    expect(screen.getByText('This rule has no dark branch.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add a dark branch' }));
    expect(firstDef(onChange).semantics!['fg-muted']).toEqual({ by: 'mode', light, dark: light });
  });

  it('clears a set alpha', async () => {
    const onChange = renderSemantics(setSemantic(weasel, 'fg-muted', { ref: 'gray-300', alpha: 0.5, type: 'color' }));
    await userEvent.click(screen.getByRole('button', { name: 'fg-muted' }));
    await userEvent.click(screen.getByRole('button', { name: 'Clear alpha' }));
    expect(firstDef(onChange).semantics!['fg-muted']).toEqual({ ref: 'gray-300', type: 'color' });
  });
});

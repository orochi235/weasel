import { render, screen, fireEvent } from '@testing-library/react';
import type { Action, Tool } from '@weasel-js/core';
import { ResolutionWidget } from './ToolkitBuilder';

// ─────────────────────────────────────────────────────────────────────────
// Fixture: three tools whose drag bindings all match the same press, so the
// widget has something to rank. `select` is active, `viewport` is ambient —
// which is the pair that shows scope beating specificity (viewport's bare
// drag is LESS specific and still can't win, because active outranks
// ambient before specificity is consulted).
// ─────────────────────────────────────────────────────────────────────────

const isAnchor = (hit: unknown): boolean =>
  (hit as { kind?: string } | undefined)?.kind === 'anchor';

const TOOLS: readonly Tool<unknown>[] = [
  {
    id: 'select',
    eligibility: { focus: true },
    bindings: [{ spec: { kind: 'drag', target: 'selected-body' }, actionId: 'move' }],
  },
  {
    id: 'pen',
    eligibility: { focus: true },
    bindings: [
      { spec: { kind: 'drag', target: { kindOf: isAnchor } }, actionId: 'pen.adjust' },
      // A string `affordance:` target — this is what the widget walks to
      // learn which chrome kinds exist, so the picker can offer them.
      { spec: { kind: 'click', target: 'affordance:anchor' }, actionId: 'pen.select' },
    ],
  },
  {
    id: 'viewport',
    eligibility: { always: true },
    bindings: [{ spec: { kind: 'drag' }, actionId: 'viewport.dragPan' }],
  },
];

const ACTIONS: readonly Action[] = [
  'move', 'pen.adjust', 'pen.select', 'viewport.dragPan',
].map((id) => ({
  id,
  label: id,
  invoker: { timing: 'immediate' as const, run: () => {} },
}));

const AMBIENT_TOOL_IDS = ['viewport'];

function renderWidget(activeToolId = 'select') {
  return render(
    <ResolutionWidget
      tools={TOOLS}
      actions={ACTIONS}
      ambientToolIds={AMBIENT_TOOL_IDS}
      activeToolId={activeToolId}
    />,
  );
}

/** The `?` caveat badge, found by its title rather than its CSS-module class
 *  (the class name is hashed at build time; the title is the contract). */
function predicateBadges(container: HTMLElement): Element[] {
  return [...container.querySelectorAll('[title^="Evaluated against a synthesized hit"]')];
}

function verdictCells(text: string): HTMLElement[] {
  return screen.queryAllByRole('cell', { name: text });
}

describe('ResolutionWidget', () => {
  it('marks exactly one candidate as firing and the rest as shadowed', () => {
    renderWidget();
    // Default input is drag on a selected body: select's `selected-body` drag
    // and viewport's bare drag both match.
    expect(verdictCells('fires')).toHaveLength(1);
    expect(verdictCells('shadowed').length).toBeGreaterThanOrEqual(1);
    // The winner is the active tool's action, not the ambient one — even
    // though both are eligible.
    expect(screen.getByRole('row', { name: /move/ }).textContent).toContain('fires');
    expect(screen.getByRole('row', { name: /viewport\.dragPan/ }).textContent)
      .toContain('shadowed');
  });

  it('reports the scope each candidate rides', () => {
    renderWidget();
    expect(verdictCells('active')).toHaveLength(1);
    expect(verdictCells('ambient')).toHaveLength(1);
  });

  it('badges predicate-target rows and leaves string-target rows unbadged', () => {
    // Under the default body target, `pen` contributes nothing: it is not the
    // active tool, and its `kindOf` predicate correctly declines a body target
    // anyway (there is no affordance hit to be an anchor). The two rows that
    // DO show are a string target and a bare no-target binding — neither is a
    // predicate, so neither gets the caveat.
    const { container, unmount } = renderWidget();
    expect(screen.getAllByRole('row')).toHaveLength(3); // header + 2 candidates
    expect(predicateBadges(container)).toHaveLength(0);
    unmount();

    // Make `pen` active and aim at the chrome kind its predicate accepts. Now
    // the predicate binding is a real candidate — and it is the only badged
    // row, with viewport's untargeted drag alongside it as the control.
    const withPen = renderWidget('pen');
    fireEvent.change(screen.getByRole('combobox', { name: 'target' }), {
      target: { value: 'affordance:anchor' },
    });
    const badges = predicateBadges(withPen.container);
    expect(badges).toHaveLength(1);
    expect(badges[0]!.closest('tr')!.textContent).toContain('pen.adjust');
    expect(screen.getByRole('row', { name: /viewport\.dragPan/ })).toBeTruthy();
  });

  it('says so when nothing matches', () => {
    renderWidget();
    fireEvent.change(screen.getByRole('combobox', { name: 'gesture' }), {
      target: { value: 'key' },
    });
    expect(screen.getByText('No binding matches this input.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });
});

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { DispatchRecord } from '@weasel-js/core/routing';
import { FallthroughDiagram } from './FallthroughDiagram';
import { gestureRouteSegments } from '../GestureRoute';
import * as fixtures from './fixtures';
import * as PkgRoot from '../../index';

const records: [string, DispatchRecord][] = Object.entries(fixtures);

const band = (name: string) => screen.getByRole('region', { name });
const rankedRows = (container: HTMLElement) => [...container.querySelectorAll('tr[data-walk]')];

describe('FallthroughDiagram fixtures', () => {
  it.each(records)('every route in %s parses', (_, record) => {
    for (const c of record.matched) for (const r of c.routes) expect(() => gestureRouteSegments(r)).not.toThrow();
  });

  it.each(records)('%s renders', (_, record) => {
    const { container } = render(<FallthroughDiagram record={record} />);
    expect(container.firstElementChild?.getAttribute('data-outcome')).toBe(record.outcome);
  });
});

describe('FallthroughDiagram', () => {
  it('marks the fired row, and only that row', () => {
    const { container } = render(<FallthroughDiagram record={fixtures.escapeInPathEdit} />);
    const rows = rankedRows(container);
    expect(rows).toHaveLength(3);
    const winners = rows.filter((r) => r.hasAttribute('data-winner'));
    expect(winners).toHaveLength(1);
    expect(winners[0]!.textContent).toContain('exitPathEdit');
    expect(winners[0]!.getAttribute('aria-current')).toBe('true');
    expect(rows[0]!.textContent).toContain('declined: not-applicable');
    expect(rows[2]!.textContent).toContain('not asked');
  });

  it('numbers ranked rows from 1 and prints the specificity tuple', () => {
    const { container } = render(<FallthroughDiagram record={fixtures.escapeInPathEdit} />);
    const cells = rankedRows(container).map((r) => [...r.querySelectorAll('td')].map((td) => td.textContent));
    expect(cells.map((c) => c[0])).toEqual(['1', '2', '3']);
    expect(cells[0]).toContain('0 0 1 1');
    expect(cells[1]).toContain('mode: path-edit');
  });

  it('labels each row with the step that placed it', () => {
    const { container } = render(<FallthroughDiagram record={fixtures.escapeInPathEdit} />);
    const text = rankedRows(container).map((r) => r.textContent ?? '');
    expect(text[0]).toContain('first');
    expect(text[1]).toContain('specificity · phase');
    expect(text[2]).toContain('context');

    const drag = render(<FallthroughDiagram record={fixtures.bareDragSelect} />);
    const dragText = rankedRows(drag.container).map((r) => r.textContent ?? '');
    expect(dragText[1]).toContain('tier');
    expect(dragText[1]).toContain('duplicate');
    expect(dragText[2]).toContain('context');
  });

  it('says when a filter dropped nothing', () => {
    render(<FallthroughDiagram record={fixtures.escapeInPathEdit} />);
    expect(band('Claim').getAttribute('data-filter')).toBe('claim');
    expect(within(band('Claim')).getByText('dropped nothing')).toBeTruthy();
    expect(within(band('Eligibility')).getByText('dropped nothing')).toBeTruthy();
  });

  it('names what the claim dropped and whose claim it was', () => {
    render(<FallthroughDiagram record={fixtures.claimDropped} />);
    const claim = band('Claim');
    const rows = within(claim).getAllByRole('row').slice(1);
    expect(rows.map((r) => r.querySelector('td')?.textContent)).toEqual(['move', 'viewport.dragPan']);
    for (const r of rows) expect(r.textContent).toContain('barred by the exclusive claim of layer:diagram-ports');
    expect(within(band('Eligibility')).getByText('dropped nothing')).toBeTruthy();
  });

  it('names the rule an ineligible binding failed', () => {
    render(<FallthroughDiagram record={fixtures.predictedHover} />);
    const elig = band('Eligibility');
    expect(elig.getAttribute('data-filter')).toBe('ineligible');
    expect(elig.textContent).toContain('transformSelection');
    expect(elig.textContent).toContain('capability: has-selection does not hold');
  });

  it('marks a predicted record and its would-fire winner', () => {
    const { container } = render(<FallthroughDiagram record={fixtures.predictedHover} />);
    expect(screen.getByText('predicted')).toBeTruthy();
    const winner = container.querySelector('tr[data-winner]');
    expect(winner?.getAttribute('data-walk')).toBe('would-fire');
    expect(winner?.textContent).toContain('would fire');
  });

  it('draws every route of a candidate', () => {
    render(<FallthroughDiagram record={fixtures.predictedHover} />);
    expect(screen.getAllByLabelText('[*:*] drag => anchor +shift').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('[*:*] drag => anchor').length).toBeGreaterThan(0);
  });

  it('shows the owning tool, or "action" for an action binding', () => {
    render(<FallthroughDiagram record={fixtures.bareDragSelect} />);
    const matched = screen.getByRole('region', { name: 'Matched' });
    const tools = within(matched).getAllByRole('row').slice(1).map((r) => r.querySelectorAll('td')[2]?.textContent);
    expect(tools).toEqual(['select', 'action', 'action']);
  });

  it('draws one line when nothing matched', () => {
    const { container } = render(<FallthroughDiagram record={fixtures.nothingMatched} />);
    expect(screen.getByText('Nothing matched this input.')).toBeTruthy();
    expect(screen.queryByRole('region')).toBeNull();
    expect(container.querySelector('[data-key=" "]')?.textContent).toBe('Space');
  });

  it('is exported from the package root', () => {
    expect(PkgRoot.FallthroughDiagram).toBe(FallthroughDiagram);
  });
});

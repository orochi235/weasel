/** A registry entry's bindings, each drawn as its routes. */
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { DispatchRecord } from '@weasel-js/core/routing';
import { Bindings } from './Bindings';
import { FallthroughDiagram } from './FallthroughDiagram';
import { escapeInPathEdit } from './FallthroughDiagram.fixtures';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const ROUTE = '[*:initial] keyDown(Delete)';
const duplicateKeyWarnings = (spy: ReturnType<typeof vi.spyOn>) =>
  spy.mock.calls.filter((args: unknown[]) => args.some((a) => typeof a === 'string' && a.includes('same key')));

it('draws a binding that expands to one route twice without a key collision', () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const { container } = render(<Bindings bindings={[{ actionId: 'delete', spec: null, routes: [ROUTE, ROUTE], opts: null }]} />);
  expect(container.querySelectorAll('[aria-label="Bindings"] li > span:first-child > *')).toHaveLength(2);
  expect(duplicateKeyWarnings(spy)).toEqual([]);
});

it("draws a candidate's repeated route in the fallthrough diagram without a key collision", () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const [first, ...rest] = escapeInPathEdit.matched;
  const record: DispatchRecord = { ...escapeInPathEdit, matched: [{ ...first!, routes: [ROUTE, ROUTE] }, ...rest] };
  render(<FallthroughDiagram record={record} />);
  expect(duplicateKeyWarnings(spy)).toEqual([]);
});

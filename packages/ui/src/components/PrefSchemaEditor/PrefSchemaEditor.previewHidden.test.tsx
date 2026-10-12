import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { PrefGroup, PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';

afterEach(cleanup);

const flag = (name: string): PrefLeaf => ({ kind: 'boolean', name, description: '', default: false }) as PrefLeaf;
const size = (path: string): PrefLeaf =>
  ({ kind: 'number', name: 'Grid size', description: '', default: 8, showIf: { path } }) as PrefLeaf;

const preview = () => screen.getByRole('region', { name: 'Live preview' });
const row = (path: string): HTMLElement => {
  const el = preview().querySelector<HTMLElement>(`[data-pref-path="${path}"]`);
  if (el === null) throw new Error(`the preview draws nothing at ${path}`);
  return el;
};

describe("PrefSchemaEditor: a node whose showIf fails at the schema's defaults", () => {
  it('is drawn in the preview of a preferences schema, marked hidden, as a row to pick', () => {
    const schema: PrefGroup = { name: 'Prefs', children: { view: { name: 'View', children: { grid: flag('Show grid'), size: size('view.grid') } } } };
    render(<PrefSchemaEditor schema={schema} onChange={() => {}} />);
    expect(within(row('view.size')).getByRole('spinbutton', { name: 'Grid size' })).toBeInTheDocument();
    expect(row('view.size')).toHaveAttribute('data-pref-hidden');
    expect(row('view.size')).toHaveAttribute('data-pref-leaf');
    expect(row('view.grid')).not.toHaveAttribute('data-pref-hidden');
  });

  it('is drawn in the preview of a toolbar', () => {
    const schema: PrefGroup = { name: 'Bar', as: 'bar', children: { grid: flag('Show grid'), size: size('grid') } };
    render(<PrefSchemaEditor schema={schema} onChange={() => {}} />);
    expect(row('size')).toHaveAttribute('data-pref-hidden');
  });

  it('is drawn in the preview of a node property schema', () => {
    const schema: PrefSection = { name: 'Rect', members: { 'data.grid': flag('Show grid'), 'data.size': size('data.grid') } };
    render(<PrefSchemaEditor schema={schema} onChange={() => {}} />);
    expect(within(row('data.size')).getByRole('spinbutton', { name: 'Grid size' })).toBeInTheDocument();
    expect(row('data.size')).toHaveAttribute('data-pref-hidden');
  });
});

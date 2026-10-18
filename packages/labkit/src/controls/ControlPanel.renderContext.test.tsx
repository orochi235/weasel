import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import type { ControlRenderer } from '../config/types';
import { ControlPanel } from './ControlPanel';

afterEach(cleanup);

describe('<ControlPanel> renderer context', () => {
  it("carries the panel's whole config, to a node's .render, a lab renderer, and a dialog body", () => {
    const seen: string[] = [];
    const note =
      (tag: string): ControlRenderer =>
      (ctx) => {
        seen.push(`${tag}:${(ctx.values as { unit: string }).unit}`);
        return <span>{tag}</span>;
      };
    const schema = resolveConfigSchema(
      f.schema({
        unit: f.string('px'),
        a: f.number(1).render(note('a')),
        b: f.custom('thing', 0),
        c: f.list<string>([], f.string('')).label('Items').dialog(note('c')),
      }),
      [],
    );
    render(
      <ControlPanel
        schema={schema}
        config={{ unit: 'em', a: 1, b: 0, c: [] }}
        setConfig={vi.fn()}
        renderers={{ thing: note('b') }}
      />,
    );
    expect(seen).toEqual(expect.arrayContaining(['a:em', 'b:em']));
    fireEvent.click(screen.getByRole('button', { name: 'Edit Items' }));
    expect(seen).toContain('c:em');
  });
});

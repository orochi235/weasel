import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import type { LeafRenderer } from '../config/types';
import { ControlPanel } from './ControlPanel';

afterEach(cleanup);

describe('<ControlPanel> renderer context', () => {
  it("carries the panel's whole config, to a node's .render, a lab renderer, and a dialog body", () => {
    const seen: string[] = [];
    const note =
      (tag: string): LeafRenderer =>
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

  it("hands a custom row the panel's draftConfig at its own path, and nothing where the panel has none", () => {
    const drafts: ((value: unknown) => void)[] = [];
    const schema = resolveConfigSchema(
      f.schema({
        curve: f.custom('curve', 0).render((ctx) => {
          if (ctx.drafts) drafts.push(ctx.drafts.setValue);
          return <span>curve</span>;
        }),
      }),
      [],
    );
    const draftConfig = vi.fn();
    const { unmount } = render(
      <ControlPanel
        schema={schema}
        config={{ curve: 0 }}
        setConfig={vi.fn()}
        draftConfig={draftConfig}
      />,
    );
    drafts.at(-1)?.(3);
    expect(draftConfig).toHaveBeenCalledWith('curve', 3);
    unmount();
    drafts.length = 0;
    render(<ControlPanel schema={schema} config={{ curve: 0 }} setConfig={vi.fn()} />);
    expect(drafts).toEqual([]);
  });

  it('hands a renderer the config source, which a reset of its leaf goes through', () => {
    const setConfig = vi.fn();
    const seen: unknown[] = [];
    const schema = resolveConfigSchema(
      f.schema({
        unit: f.string('px'),
        a: f.number(1).render((ctx) => {
          seen.push(ctx.source.valueAt('unit').value);
          return (
            <button type="button" onClick={ctx.reset}>
              reset a
            </button>
          );
        }),
      }),
      [],
    );
    render(<ControlPanel schema={schema} config={{ unit: 'em', a: 3 }} setConfig={setConfig} />);
    expect(seen[0]).toBe('em');
    fireEvent.click(screen.getByRole('button', { name: 'reset a' }));
    expect(setConfig).toHaveBeenCalledWith('a', 1);
  });
});

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlPanel } from './ControlPanel';

afterEach(cleanup);

describe('<ControlPanel> action rows', () => {
  it('reads an f.action label once, on its button, at the root, in a group and in a section', () => {
    const schema = resolveConfigSchema(
      f.schema({
        add: f.action(() => {}).label('add level'),
        level: f.group({ remove: f.action(() => {}).label('remove level') }).label('Level'),
        reset: f
          .action(() => {})
          .label('reset all')
          .section('Tools'),
      }),
      [],
    );
    render(<ControlPanel schema={schema} config={{}} setConfig={vi.fn()} />);
    for (const text of ['add level', 'remove level', 'reset all']) {
      expect(screen.getAllByText(text)).toHaveLength(1);
      expect(screen.getByRole('button', { name: text })).toBeTruthy();
    }
  });

  it("hands an action's run the panel's config and setConfig", () => {
    const run = vi.fn(({ config, setConfig }) => setConfig('count', (config.count as number) + 1));
    const setConfig = vi.fn();
    const schema = resolveConfigSchema(
      f.schema({ count: f.number(2), bump: f.action(run).label('bump') }),
      [],
    );
    render(<ControlPanel schema={schema} config={{ count: 2 }} setConfig={setConfig} />);
    fireEvent.click(screen.getByRole('button', { name: 'bump' }));
    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'bump', config: { count: 2 } }),
    );
    expect(setConfig).toHaveBeenCalledWith('count', 3);
  });

  it("hands the run of an action in a bar the panel's config too", () => {
    const run = vi.fn();
    const schema = resolveConfigSchema(
      f.schema({
        tools: f.group({ on: f.boolean(false), go: f.action(run).label('go') }).as('bar'),
      }),
      [],
    );
    render(<ControlPanel schema={schema} config={{ tools: { on: true } }} setConfig={vi.fn()} />);
    fireEvent.click(within(screen.getByRole('toolbar')).getByRole('button', { name: 'go' }));
    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'tools.go', config: { tools: { on: true } } }),
    );
  });
});

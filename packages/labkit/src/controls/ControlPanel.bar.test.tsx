import { fireEvent, render, screen, within } from '@testing-library/react';
import { PARAMS_TEXT_WAIT_MS } from '@weasel-js/ui/components/Prefs';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlPanel } from './ControlPanel';

describe('<ControlPanel> group drawn as a bar', () => {
  const schema = () =>
    resolveConfigSchema(
      f.schema({
        text: f.group({ bold: f.boolean(false), size: f.number(12) }).as('bar'),
      }),
      [],
    );

  it('is one line of bar forms under no heading', () => {
    render(
      <ControlPanel
        schema={schema()}
        config={{ text: { bold: false, size: 12 } }}
        setConfig={vi.fn()}
      />,
    );
    const bar = screen.getByRole('toolbar');
    expect(screen.queryByRole('heading')).toBeNull();
    // A flag is a checkbox in a row and a button in a bar.
    expect(within(bar).getByRole('button', { name: /bold/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(within(bar).queryByRole('checkbox')).toBeNull();
    expect(bar.querySelector('[data-bar-label]')).not.toBeNull();
  });

  it('opens what does not fit from a button where the group says so', () => {
    const menu = resolveConfigSchema(
      f.schema({
        text: f
          .group({ bold: f.boolean(false), size: f.number(12) })
          .as('bar')
          .overflow('menu'),
      }),
      [],
    );
    render(
      <ControlPanel
        schema={menu}
        config={{ text: { bold: false, size: 12 } }}
        setConfig={vi.fn()}
      />,
    );
    expect(screen.getByRole('toolbar')).toHaveAttribute('data-overflow', 'menu');
  });

  it('writes a cell’s edit at the leaf’s path', () => {
    const setConfig = vi.fn();
    render(
      <ControlPanel
        schema={schema()}
        config={{ text: { bold: false, size: 12 } }}
        setConfig={setConfig}
      />,
    );
    fireEvent.click(within(screen.getByRole('toolbar')).getByRole('button', { name: /bold/i }));
    expect(setConfig).toHaveBeenCalledWith('text.bold', true);
  });
});

describe('<ControlPanel> text in a bar', () => {
  it('waits the lab text wait before it drafts, as a row does', () => {
    vi.useFakeTimers();
    try {
      const schema = resolveConfigSchema(
        f.schema({ text: f.group({ title: f.string('') }).as('bar') }),
        [],
      );
      const draftConfig = vi.fn();
      render(
        <ControlPanel
          schema={schema}
          config={{ text: { title: '' } }}
          setConfig={vi.fn()}
          draftConfig={draftConfig}
        />,
      );
      fireEvent.change(within(screen.getByRole('toolbar')).getByRole('textbox'), {
        target: { value: 'a' },
      });
      expect(draftConfig).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(PARAMS_TEXT_WAIT_MS.lab));
      expect(draftConfig).toHaveBeenCalledWith('text.title', 'a');
    } finally {
      vi.useRealTimers();
    }
  });
});

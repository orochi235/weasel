import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefsForm, type PrefRenderContext } from './PrefsForm';

afterEach(cleanup);

const flag = { kind: 'boolean', name: 'Flag', description: '', default: true } as const;

describe('PrefsForm list leaf', () => {
  const schema: PrefGroup = {
    name: 'Root',
    children: { flags: { kind: 'list', name: 'Flags', description: '', default: [false, false], item: flag } },
  };

  it('draws one control per entry, each as the item leaf, and commits the whole array', () => {
    const onChange = vi.fn();
    render(<PrefsForm schema={schema} values={{}} onChange={onChange} />);
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Flag 2' }));
    expect(onChange).toHaveBeenCalledWith('flags', [false, true]);
  });

  it('adds an entry at the item default and removes one', () => {
    const onChange = vi.fn();
    render(<PrefsForm schema={schema} values={{ flags: [false] }} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onChange).toHaveBeenLastCalledWith('flags', [false, true]);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Flag 1' }));
    expect(onChange).toHaveBeenLastCalledWith('flags', []);
  });

  it('stops adding at maxItems and removing at minItems', () => {
    const bounded: PrefGroup = {
      name: 'Root',
      children: {
        flags: { kind: 'list', name: 'Flags', description: '', default: [true], item: flag, minItems: 1, maxItems: 1 },
      },
    };
    render(<PrefsForm schema={bounded} values={{}} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove Flag 1' })).toBeDisabled();
  });

  it('keeps text fields for a list of strings', () => {
    const strings: PrefGroup = {
      name: 'Root',
      children: {
        globs: {
          kind: 'list',
          name: 'Globs',
          description: '',
          default: ['a'],
          item: { kind: 'string', name: 'Glob', description: '', default: '' },
        },
      },
    };
    const onChange = vi.fn();
    render(<PrefsForm schema={strings} values={{}} onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Glob 1' }), { target: { value: 'b' } });
    expect(onChange).toHaveBeenCalledWith('globs', ['b']);
  });

  it('nests: a list of lists edits the inner entry and commits the outer array', () => {
    const grid: PrefGroup = {
      name: 'Root',
      children: {
        rows: {
          kind: 'list',
          name: 'Rows',
          description: '',
          default: [[true], [false]],
          item: { kind: 'list', name: 'Row', description: '', default: [], item: flag },
        },
      },
    };
    const onChange = vi.fn();
    render(<PrefsForm schema={grid} values={{}} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole('checkbox')[1]!);
    expect(onChange).toHaveBeenCalledWith('rows', [[true], [true]]);
  });

  it("hands an entry of an app-defined kind to that kind's renderer", () => {
    const tags: PrefGroup = {
      name: 'Root',
      children: {
        tags: {
          kind: 'list',
          name: 'Tags',
          description: '',
          default: ['x', 'y'],
          item: { kind: 'tag', name: 'Tag', description: '', default: '' },
        },
      },
    };
    const paths = new Set<string>();
    const tag = (ctx: PrefRenderContext) => {
      paths.add(ctx.path);
      return <button onClick={() => ctx.setValue('z')}>{`tag ${String(ctx.value)}`}</button>;
    };
    const onChange = vi.fn();
    render(<PrefsForm schema={tags} values={{}} onChange={onChange} renderers={{ tag }} />);
    expect([...paths]).toEqual(['tags.0', 'tags.1']);
    fireEvent.click(screen.getByRole('button', { name: 'tag y' }));
    expect(onChange).toHaveBeenCalledWith('tags', ['x', 'z']);
  });
});

describe('PrefsForm object leaf', () => {
  it("hands a field of an app-defined kind to that kind's renderer", () => {
    const schema: PrefGroup = {
      name: 'Root',
      children: {
        box: {
          kind: 'object',
          name: 'Box',
          description: '',
          default: { tag: 'x' },
          children: { tag: { kind: 'tag', name: 'Tag', description: '', default: '' } },
        },
      },
    };
    render(
      <PrefsForm
        schema={schema}
        values={{}}
        onChange={() => {}}
        renderers={{ tag: (ctx) => <span>{`tag ${String(ctx.value)}`}</span> }}
      />,
    );
    expect(screen.getByText('tag x')).toBeInTheDocument();
  });
});

describe('PrefsForm action leaf', () => {
  const schemaWith = (run: () => void | Promise<void>, label?: string): PrefGroup => ({
    name: 'Root',
    children: {
      wipe: { kind: 'action', name: 'Wipe cache', description: '', default: undefined, run, ...(label ? { label } : {}) },
    },
  });

  it("draws a button that calls run with the leaf's path, and writes no value", () => {
    const run = vi.fn();
    const onChange = vi.fn();
    render(<PrefsForm schema={schemaWith(run, 'Wipe')} values={{}} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Wipe' }));
    expect(run).toHaveBeenCalledWith({ path: 'wipe' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('is disabled while the promise run returned is pending', async () => {
    let finish!: () => void;
    const run = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    render(<PrefsForm schema={schemaWith(run)} values={{}} onChange={() => {}} />);
    const button = screen.getByRole('button', { name: 'Wipe cache' });
    fireEvent.click(button);
    expect(button).toBeDisabled();
    await act(async () => {
      finish();
    });
    expect(button).not.toBeDisabled();
  });
});

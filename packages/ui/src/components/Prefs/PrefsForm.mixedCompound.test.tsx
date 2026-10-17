import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import type { PrefBoolean, PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { PrefsForm, type PrefRenderContext } from './index';
import { renderWithIcons } from '../../testing/withIcons';

afterEach(cleanup);

const flag: PrefBoolean = { kind: 'boolean', name: 'Flag', description: '', default: false };
const text = (name: string): PrefLeaf => ({ kind: 'string', name, description: '', default: '' });

const STROKE: PrefGroup = {
  name: 'Prefs',
  children: {
    stroke: {
      kind: 'object',
      name: 'Stroke',
      description: '',
      default: { on: false, cap: 'butt', dash: { round: false } },
      children: {
        on: { ...flag, name: 'Visible' },
        cap: text('Cap'),
        dash: { kind: 'object', name: 'Dash', description: '', default: { round: false }, children: { round: { ...flag, name: 'Round' } } },
      },
    },
  },
};

const HELD = { stroke: { on: true, cap: 'round', dash: { round: true } } };

function form(schema: PrefGroup, values: unknown, mixed: string[], more: Partial<Parameters<typeof PrefsForm>[0]> = {}) {
  const onChange = vi.fn();
  renderWithIcons(<PrefsForm layout="list" schema={schema} values={values} onChange={onChange} mixed={new Set(mixed)} {...more} />);
  return onChange;
}

describe('PrefsForm object leaf with mixed fields', () => {
  it('draws the field at a mixed path as mixed, and the others with their values', () => {
    form(STROKE, HELD, ['stroke.cap']);
    expect(screen.getByRole('textbox', { name: 'Cap' })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'Cap' })).toHaveAttribute('placeholder', 'Mixed');
    expect(screen.getByRole('checkbox', { name: 'Visible' })).toBeChecked();
  });

  it('writes any field at its own path while one of the object\'s fields is mixed', () => {
    const onChange = form(STROKE, HELD, ['stroke.cap']);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Visible' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith('stroke.on', false);
  });

  it('writes a field at its own path where the mixed one is in an object nested beside it', () => {
    const onChange = form(STROKE, HELD, ['stroke.dash.round']);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Visible' }));
    expect(onChange).toHaveBeenLastCalledWith('stroke.on', false);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Round' }));
    expect(onChange).toHaveBeenLastCalledWith('stroke.dash.round', true);
  });

  it('draws every field as mixed where the object\'s own path is, and writes each at its own', () => {
    const onChange = form(STROKE, HELD, ['stroke']);
    expect(screen.getByRole('textbox', { name: 'Cap' })).toHaveAttribute('placeholder', 'Mixed');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Round' }));
    expect(onChange).toHaveBeenLastCalledWith('stroke.dash.round', true);
  });

  it('still commits the object whole where nothing under it is mixed', () => {
    const onChange = form(STROKE, HELD, []);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Visible' }));
    expect(onChange).toHaveBeenLastCalledWith('stroke', { on: false, cap: 'round', dash: { round: true } });
  });

  it('tells a custom renderer for a field that the field is mixed', () => {
    const seen: PrefRenderContext[] = [];
    form(STROKE, HELD, ['stroke.cap'], { renderers: { string: (ctx) => { seen.push(ctx); return <span>cap</span>; } } });
    expect(seen.at(-1)).toMatchObject({ path: 'stroke.cap', mixed: true, value: undefined });
  });
});

describe('PrefsForm list, map, and union leaves at a mixed path', () => {
  const schema: PrefGroup = {
    name: 'Prefs',
    children: {
      flags: { kind: 'list', name: 'Flags', description: '', default: [], item: flag },
      names: { kind: 'list', name: 'Names', description: '', default: [], item: text('Name') },
      on: { kind: 'map', name: 'On', description: '', default: {}, item: flag },
      shape: {
        kind: 'union',
        name: 'Shape',
        description: '',
        tag: 'type',
        default: { type: 'circle', filled: true },
        variants: {
          circle: { kind: 'object', name: 'Circle', description: '', default: { filled: true }, children: { filled: { ...flag, name: 'Filled' } } },
          box: { kind: 'object', name: 'Box', description: '', default: { square: false }, children: { square: { ...flag, name: 'Square' } } },
        },
      },
    },
  };
  const values = { flags: [true], names: ['a'], on: { left: true }, shape: { type: 'box', square: false } };

  it.each(['flags', 'names', 'on'])('draws the word Mixed in place of the editor at %s', (path) => {
    form(schema, values, [path]);
    expect(screen.getByText('Mixed')).toBeInTheDocument();
  });

  it('offers no Add at a mixed list, which would write one entry over them all', () => {
    form({ name: 'Prefs', children: { flags: schema.children.flags! } }, values, ['flags']);
    expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('offers no Add at a mixed map', () => {
    form({ name: 'Prefs', children: { on: schema.children.on! } }, values, ['on']);
    expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('draws a mixed union\'s choice as mixed, with no variant\'s fields', () => {
    form({ name: 'Prefs', children: { shape: schema.children.shape! } }, values, ['shape']);
    expect(screen.getByText('Mixed')).toBeInTheDocument();
    expect(screen.queryByText('Choose option…')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('writes a field of a union\'s variant at its own path while that field is mixed', () => {
    const onChange = form({ name: 'Prefs', children: { shape: schema.children.shape! } }, values, ['shape.square']);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Square' }));
    expect(onChange).toHaveBeenLastCalledWith('shape.square', true);
  });
});

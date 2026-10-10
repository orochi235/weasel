import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PrefGroup } from '@weasel-js/prefs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { prefFieldProps } from './prefField';
import { PrefsForm } from './PrefsForm';
import { prefFieldChoices } from './schema';

afterEach(cleanup);

const SCHEMA: PrefGroup = {
  name: 'Root',
  children: {
    camera: { name: 'Camera', children: {
      type: { kind: 'enum', name: 'Type', description: '', default: 'persp', options: [{ value: 'persp', label: 'Perspective' }] },
      fov: { kind: 'number', name: 'Field of view', description: '', default: 50 },
    } },
    stroke: { kind: 'object', name: 'Stroke', description: '', default: {}, children: {
      shape: { name: 'Shape', children: {
        width: { kind: 'number', name: 'Width', description: '', default: 1 },
      } },
    } },
    follows: { kind: 'field', name: 'Follows', description: '', default: '', kinds: ['number'] },
  },
};

describe('prefFieldChoices', () => {
  it('lists every leaf by its full path, group keys counted, and an object\'s fields under it', () => {
    expect(prefFieldChoices(SCHEMA).map((f) => f.path)).toEqual([
      'camera.type', 'camera.fov', 'stroke', 'stroke.width', 'follows',
    ]);
  });

  it('leaves group keys out of the path for a surface that does', () => {
    expect(prefFieldChoices(SCHEMA, false).map((f) => f.path)).toEqual([
      'type', 'fov', 'stroke', 'stroke.width', 'follows',
    ]);
  });
});

describe('a field leaf', () => {
  it('offers the fields of the kinds it allows, named with their paths', () => {
    const leaf = SCHEMA.children.follows as Parameters<typeof prefFieldProps>[0];
    const field = prefFieldProps(leaf, { value: 'camera.fov', setValue: () => {}, fields: prefFieldChoices(SCHEMA) });
    expect(field).toMatchObject({ kind: 'enum', control: 'select', value: 'camera.fov' });
    expect(field?.kind === 'enum' && field.options.map((o) => o.label)).toEqual([
      'Field of view (camera.fov)', 'Width (stroke.width)',
    ]);
  });

  it('still shows a reference to a field the surface does not draw', () => {
    const leaf = SCHEMA.children.follows as Parameters<typeof prefFieldProps>[0];
    const field = prefFieldProps(leaf, { value: 'gone.away', setValue: () => {}, fields: [] });
    expect(field?.kind === 'enum' && field.options.map((o) => o.value)).toEqual(['gone.away']);
  });

  it('is drawn by a prefs form as a picker over that form\'s fields', () => {
    const onChange = vi.fn();
    render(<PrefsForm schema={SCHEMA} values={{}} onChange={onChange} layout="list" />);
    fireEvent.click(screen.getByRole('button', { name: /Follows/ }));
    fireEvent.click(screen.getByRole('option', { name: 'Width (stroke.width)' }));
    expect(onChange).toHaveBeenCalledWith('follows', 'stroke.width');
  });
});

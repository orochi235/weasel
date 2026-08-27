import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PrefsForm, type PrefRenderContext } from './PrefsForm';
import { visiblePrefSubtree, type PrefGroup } from './schema';

const SCHEMA: PrefGroup = {
  name: 'Preferences',
  children: {
    canvas: {
      name: 'Canvas',
      description: 'Drawing surface behavior.',
      children: {
        showGrid: {
          kind: 'boolean',
          name: 'Show grid',
          description: 'Draw the alignment grid.',
          default: true,
        },
        smoothing: {
          kind: 'boolean',
          name: 'Smoothing',
          description: 'Antialias strokes.',
          default: false,
          control: 'switch',
        },
        zoomStep: {
          kind: 'number',
          name: 'Zoom step',
          description: 'Wheel zoom increment.',
          default: 10,
          min: 1,
          max: 50,
        },
        opacity: {
          kind: 'number',
          name: 'Opacity',
          description: 'Default fill opacity.',
          default: 80,
          min: 0,
          max: 100,
          control: 'slider',
        },
        theme: {
          kind: 'enum',
          name: 'Theme',
          description: 'Color scheme.',
          default: 'dark',
          options: [
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' },
          ],
        },
        secret: {
          kind: 'boolean',
          name: 'Secret flag',
          description: 'Internal toggle.',
          default: false,
          hidden: true,
        },
      },
    },
    io: {
      name: 'Import / Export',
      children: {
        author: {
          kind: 'string',
          name: 'Author',
          description: 'Embedded in exported metadata.',
          default: '',
        },
        favoriteShape: {
          kind: 'registry-enum',
          name: 'Favorite shape',
          description: 'Resolved from a runtime registry.',
          default: 'rect',
        },
      },
    },
  },
};

describe('PrefsForm', () => {
  it('renders group titles and one control per visible leaf kind', () => {
    render(<PrefsForm schema={SCHEMA} onChange={() => {}} />);
    expect(screen.getByText('Canvas')).toBeTruthy();
    expect(screen.getByText('Import / Export')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Show grid' })).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Smoothing' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Zoom step' })).toBeTruthy(); // NumberField input
    expect(screen.getByRole('slider', { name: 'Opacity' })).toBeTruthy();
    // Select trigger's accessible name = "<selected label> <aria-label>".
    expect(screen.getByRole('button', { name: 'Dark Theme' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'About Theme' })).toBeTruthy(); // description affordance
    expect(screen.getByRole('textbox', { name: 'Author' })).toBeTruthy();
  });

  it('hides hidden leaves by default and reveals them with showHidden', () => {
    const { rerender } = render(<PrefsForm schema={SCHEMA} onChange={() => {}} />);
    expect(screen.queryByRole('checkbox', { name: 'Secret flag' })).toBeNull();
    rerender(<PrefsForm schema={SCHEMA} onChange={() => {}} showHidden />);
    expect(screen.getByRole('checkbox', { name: 'Secret flag' })).toBeTruthy();
  });

  it('reads sparse values by dotted path and falls back to defaults', () => {
    render(
      <PrefsForm
        schema={SCHEMA}
        values={{ canvas: { showGrid: false } }}
        onChange={() => {}}
      />,
    );
    const grid = screen.getByRole('checkbox', { name: 'Show grid' }) as HTMLInputElement;
    const smoothing = screen.getByRole('switch', { name: 'Smoothing' }) as HTMLInputElement;
    expect(grid.checked).toBe(false); // from values
    expect(smoothing.checked).toBe(false); // schema default
  });

  it('reports changes with the leaf dotted path', () => {
    const onChange = vi.fn();
    render(<PrefsForm schema={SCHEMA} onChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show grid' }));
    expect(onChange).toHaveBeenCalledWith('canvas.showGrid', false);
  });

  it('dispatches unknown kinds to the renderers map with full context', () => {
    const seen: PrefRenderContext[] = [];
    render(
      <PrefsForm
        schema={SCHEMA}
        values={{ io: { favoriteShape: 'ellipse' } }}
        onChange={() => {}}
        renderers={{
          'registry-enum': (ctx) => {
            seen.push(ctx);
            return <input aria-label={ctx.pref.name} defaultValue={String(ctx.value)} />;
          },
        }}
      />,
    );
    expect(screen.getByRole('textbox', { name: 'Favorite shape' })).toBeTruthy();
    expect(seen).toHaveLength(1);
    expect(seen[0].path).toBe('io.favoriteShape');
    expect(seen[0].value).toBe('ellipse');
  });

  it('renders a labeled placeholder for unknown kinds with no renderer', () => {
    render(<PrefsForm schema={SCHEMA} onChange={() => {}} />);
    expect(screen.getByText('(registry-enum: no renderer)')).toBeTruthy();
  });

  it('renderer overrides win over built-in kinds', () => {
    render(
      <PrefsForm
        schema={SCHEMA}
        onChange={() => {}}
        renderers={{ boolean: (ctx) => <em>custom:{ctx.pref.name}</em> }}
      />,
    );
    expect(screen.getByText('custom:Show grid')).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: 'Show grid' })).toBeNull();
  });
});

describe('PrefsForm color leaf', () => {
  it('renders color leaves with ColorField and applies commits', () => {
    const onChange = vi.fn();
    render(
      <PrefsForm
        schema={{
          name: 'root',
          children: {
            paint: {
              name: 'Paint',
              children: {
                accent: { kind: 'color', name: 'Accent', description: 'Accent color.', default: '#112233' },
              },
            },
          },
        }}
        onChange={onChange}
      />,
    );
    const input = screen.getByLabelText('Accent', { selector: 'input[type="color"]' });
    fireEvent.input(input, { target: { value: '#445566' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith('paint.accent', '#445566');
  });
});

describe('PrefsForm — union-valued leaves', () => {
  const UNION_SCHEMA: PrefGroup = {
    name: 'Appearance',
    children: {
      appearance: {
        name: 'Appearance',
        children: {
          fill: {
            kind: 'paint',
            name: 'Fill',
            description: 'Fill paint.',
            default: { fill: 'solid', color: '#000000ff' },
          },
          stroke: {
            kind: 'object',
            name: 'Stroke',
            description: 'Stroke paint and line geometry.',
            default: '#000000ff',
            block: true,
            fromScalar: (v: unknown) => ({
              paint: { fill: 'solid', color: typeof v === 'string' ? v : '#000000ff' },
            }),
            children: {
              paint: { kind: 'paint', name: 'Stroke color', description: '', default: { fill: 'solid', color: '#000000ff' } },
              width: { kind: 'number', name: 'Stroke width', description: '', default: 1, min: 0 },
            },
          },
        },
      },
    },
  };

  const renderUnion = (values: unknown, onChange = vi.fn()) => {
    render(<PrefsForm schema={UNION_SCHEMA} values={values} onChange={onChange} />);
    return onChange;
  };

  it('renders a paint leaf as a color control instead of the no-renderer placeholder', () => {
    renderUnion({ appearance: { fill: { fill: 'solid', color: '#ff0000ff' } } });
    expect(screen.getByLabelText('Fill', { selector: 'input[type="color"]' })).toHaveValue('#ff0000');
    expect(screen.queryByText('(paint: no renderer)')).toBeNull();
  });

  it('writes a whole solid paint rather than a bare color', () => {
    const onChange = renderUnion({
      appearance: {
        fill: {
          fill: 'linear-gradient',
          from: { x: 0, y: 0 }, to: { x: 1, y: 0 },
          stops: [{ offset: 0, color: '#000' }],
        },
      },
    });
    const input = screen.getByLabelText('Fill', { selector: 'input[type="color"]' });
    fireEvent.input(input, { target: { value: '#112233' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith('appearance.fill', { fill: 'solid', color: '#112233' });
  });

  it('commits the whole object when one of its fields is edited', () => {
    const onChange = renderUnion({
      appearance: { stroke: { paint: { color: '#000000ff' }, width: 6, dash: [4, 2] } },
    });
    const input = screen.getByLabelText('Stroke color', { selector: 'input[type="color"]' });
    fireEvent.input(input, { target: { value: '#445566' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith('appearance.stroke', {
      paint: { fill: 'solid', color: '#445566' },
      width: 6,
      dash: [4, 2],
    });
  });

  it('lifts a scalar value before applying a field to it', () => {
    const onChange = renderUnion({ appearance: { stroke: '#ff0000ff' } });
    const input = screen.getByLabelText('Stroke color', { selector: 'input[type="color"]' });
    fireEvent.input(input, { target: { value: '#445566' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith('appearance.stroke', {
      paint: { fill: 'solid', color: '#445566' },
    });
  });
});

describe('visiblePrefSubtree', () => {
  it('prunes groups whose leaves are all hidden', () => {
    const schema: PrefGroup = {
      name: 'Root',
      children: {
        ghost: {
          name: 'Ghost',
          children: {
            a: { kind: 'boolean', name: 'A', description: '', default: false, hidden: true },
          },
        },
      },
    };
    expect(visiblePrefSubtree(schema, false)).toBeNull();
    expect(visiblePrefSubtree(schema, true)).not.toBeNull();
  });
});

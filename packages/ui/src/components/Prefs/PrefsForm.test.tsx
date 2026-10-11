import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  PREF_KINDS,
  type PrefEnumEncoding,
  type PrefGroup,
  type PrefKind,
  type PrefNumber,
} from '@weasel-js/prefs';
import { PrefsDialog } from './PrefsDialog';
import { PrefsForm, type PrefRenderContext } from './PrefsForm';
import { rotationDegreesUnit } from '@weasel-js/core';

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
  it('renders group titles and one control per visible leaf kind', async () => {
    render(<PrefsForm schema={SCHEMA} onChange={() => {}} />);
    expect(screen.getByText('Canvas')).toBeTruthy();
    expect(screen.getByText('Import / Export')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Show grid' })).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Smoothing' })).toBeTruthy();
    expect(screen.getByRole('spinbutton', { name: 'Zoom step' })).toBeTruthy();
    expect(screen.getByRole('slider', { name: 'Opacity' })).toBeTruthy();
    // Select trigger's accessible name = "<selected label> <aria-label>".
    expect(screen.getByRole('button', { name: 'Dark Theme' })).toBeTruthy();
    // The description, on the control. The select writes its own on a later render, and the row's comes back after it.
    await waitFor(() => expect(screen.getByRole('button', { name: /Theme/ })).toHaveAccessibleDescription(/\S/));
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

  /** The paint editor lives in a popover, so reaching a control inside it
   *  means opening the field first. */
  const openPaint = (name: string): void => {
    fireEvent.click(screen.getByRole('button', { name }));
  };

  it('renders a paint leaf as a paint field instead of the no-renderer placeholder', () => {
    renderUnion({ appearance: { fill: { fill: 'solid', color: '#ff0000ff' } } });
    expect(screen.getByRole('button', { name: 'Fill' })).toHaveTextContent('Solid');
    expect(screen.queryByText('(paint: no renderer)')).toBeNull();
  });

  it('edits a gradient as a gradient rather than flattening it to a solid', () => {
    const onChange = renderUnion({
      appearance: {
        fill: {
          fill: 'linear-gradient',
          from: { x: 0, y: 0 }, to: { x: 1, y: 0 },
          stops: [{ offset: 0, color: '#000000ff' }, { offset: 1, color: '#ffffffff' }],
        },
      },
    });
    openPaint('Fill');
    const stop = screen.getByLabelText('Stop 1 at 0%');
    fireEvent.input(stop, { target: { value: '#112233' } });
    fireEvent.blur(stop);
    expect(onChange).toHaveBeenCalledWith('appearance.fill', expect.objectContaining({
      fill: 'linear-gradient',
      from: { x: 0, y: 0 },
      to: { x: 1, y: 0 },
      stops: [{ offset: 0, color: '#112233ff' }, { offset: 1, color: '#ffffffff' }],
    }));
  });

  it('writes a whole solid paint rather than a bare color', () => {
    const onChange = renderUnion({ appearance: { fill: { fill: 'solid', color: '#000000ff' } } });
    openPaint('Fill');
    const input = screen.getByLabelText('Fill', { selector: 'input[type="color"]' });
    fireEvent.input(input, { target: { value: '#112233' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith('appearance.fill', { color: '#112233' });
  });

  it('commits the whole object when one of its fields is edited', () => {
    const onChange = renderUnion({
      appearance: { stroke: { paint: { color: '#000000ff' }, width: 6, dash: [4, 2] } },
    });
    openPaint('Stroke color');
    const input = screen.getByLabelText('Stroke color', { selector: 'input[type="color"]' });
    fireEvent.input(input, { target: { value: '#445566' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith('appearance.stroke', {
      paint: { color: '#445566' },
      width: 6,
      dash: [4, 2],
    });
  });

  it('lifts a scalar value before applying a field to it', () => {
    const onChange = renderUnion({ appearance: { stroke: '#ff0000ff' } });
    openPaint('Stroke color');
    const input = screen.getByLabelText('Stroke color', { selector: 'input[type="color"]' });
    fireEvent.input(input, { target: { value: '#445566' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith('appearance.stroke', {
      paint: { color: '#445566' },
    });
  });
});

describe('PrefsForm — encoded enum leaves', () => {
  // The shape core's `stroke.dash` leaf uses: the stored value is a dash
  // array scaled by the sibling stroke width, and the thing chosen is a style.
  const dashEncoding: PrefEnumEncoding = {
    read: (stored, siblings) => {
      if (!Array.isArray(stored) || stored.length === 0) return 'solid';
      const w = typeof siblings?.width === 'number' ? siblings.width : 1;
      const [on, off] = stored as number[];
      if (on === w * 2 && off === w * 2) return 'dashed';
      if (on === 0 && off === w * 2) return 'dotted';
      return 'custom';
    },
    write: (option, siblings) => {
      const w = typeof siblings?.width === 'number' ? siblings.width : 1;
      if (option === 'dashed') return [w * 2, w * 2];
      if (option === 'dotted') return [0, w * 2];
      return undefined;
    },
  };

  const DASH_SCHEMA: PrefGroup = {
    name: 'Appearance',
    children: {
      appearance: {
        name: 'Appearance',
        children: {
          stroke: {
            kind: 'object',
            name: 'Stroke',
            description: 'Stroke geometry.',
            default: {},
            children: {
              width: { kind: 'number', name: 'Width', description: '', default: 1 },
              dash: {
                kind: 'enum',
                name: 'Style',
                description: '',
                default: 'solid',
                control: 'radio',
                encoding: dashEncoding,
                options: [
                  { value: 'solid', label: 'Solid' },
                  { value: 'dashed', label: 'Dashed' },
                  { value: 'dotted', label: 'Dotted' },
                  { value: 'custom', label: 'Custom', disabled: true },
                ],
              },
            },
          },
        },
      },
    },
  };

  const renderDash = (values: unknown, onChange = vi.fn()) => {
    render(<PrefsForm schema={DASH_SCHEMA} values={values} onChange={onChange} />);
    return onChange;
  };

  it('selects the option the stored value encodes, not the raw value', () => {
    renderDash({ appearance: { stroke: { width: 4, dash: [8, 8] } } });
    expect(screen.getByRole('radio', { name: 'Dashed' })).toBeChecked();
    // The object row's `<label>` associates with the first radio, so Solid's
    // accessible name picks up the group label twice.
    expect(screen.getByRole('radio', { name: /Solid/ })).not.toBeChecked();
  });

  it('writes the encoded form, committing the whole object', () => {
    const onChange = renderDash({ appearance: { stroke: { width: 4, dash: [8, 8] } } });
    fireEvent.click(screen.getByRole('radio', { name: 'Dotted' }));
    expect(onChange).toHaveBeenCalledWith('appearance.stroke', { width: 4, dash: [0, 8] });
  });

  it('disables an option the control reports but cannot author', () => {
    renderDash({ appearance: { stroke: { width: 4, dash: [3, 1, 5] } } });
    expect(screen.getByRole('radio', { name: 'Custom' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Custom' })).toBeChecked();
  });
});

describe('PrefsForm — exhaustiveness over built-in kinds', () => {
  const KIND = 'spline' as PrefKind;
  afterEach(() => {
    delete (PREF_KINDS as Record<string, true>)[KIND];
  });

  const schemaWith = (kind: string): PrefGroup => ({
    name: 'root',
    children: {
      g: {
        name: 'G',
        children: { leaf: { kind, name: 'Leaf', description: '', default: null } },
      },
    },
  });

  it('names an app-defined kind rather than rendering nothing', () => {
    render(<PrefsForm schema={schemaWith('registry-enum')} onChange={() => {}} />);
    expect(screen.getByText('(registry-enum: no renderer)')).toBeTruthy();
  });

  it('throws for a built-in kind with no case arm', () => {
    (PREF_KINDS as Record<string, true>)[KIND] = true;
    expect(() =>
      render(<PrefsForm schema={schemaWith(KIND)} onChange={() => {}} />),
    ).toThrow(/spline/);
  });
});

describe('PrefsForm — number leaves with a display unit', () => {
  const rotationLeaf = (extra: Record<string, unknown>): PrefGroup => ({
    name: 'root',
    children: {
      layout: {
        name: 'Layout',
        children: {
          rotation: {
            kind: 'number',
            name: 'Rotation',
            description: '',
            default: 0,
            unit: rotationDegreesUnit,
            ...extra,
          } as PrefNumber,
        },
      },
    },
  });

  const renderRotation = (extra: Record<string, unknown>, stored: number, onChange = vi.fn()) => {
    render(
      <PrefsForm
        schema={rotationLeaf(extra)}
        values={{ layout: { rotation: stored } }}
        onChange={onChange}
      />,
    );
    return onChange;
  };

  it('shows the stored value in the unit the leaf displays', () => {
    renderRotation({}, Math.PI / 4);
    expect(screen.getByRole('spinbutton', { name: 'Rotation' })).toHaveValue('45');
  });

  it('stores what a typed display value converts back to', () => {
    const onChange = renderRotation({}, Math.PI / 4);
    const field = screen.getByRole('spinbutton', { name: 'Rotation' });
    fireEvent.change(field, { target: { value: '90' } });
    fireEvent.blur(field);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toBe('layout.rotation');
    expect(onChange.mock.calls[0][1]).toBeCloseTo(Math.PI / 2);
  });

  // Bounds are declared in the stored unit, like the value. Passed through
  // raw they clamp a typed degree count against a radian range: 90 came back
  // as 6.283 (2π), the max.
  it('converts declared bounds into the unit it displays', () => {
    const onChange = renderRotation(
      { min: 0, max: Math.PI * 2, step: Math.PI / 180 },
      Math.PI / 4,
    );
    const field = screen.getByRole('spinbutton', { name: 'Rotation' });
    fireEvent.change(field, { target: { value: '90' } });
    fireEvent.blur(field);
    expect(onChange.mock.calls[0][1]).toBeCloseTo(Math.PI / 2);
  });

  it('reads a unit typed in place of the one it shows', () => {
    const onChange = renderRotation({}, Math.PI / 4);
    const field = screen.getByRole('spinbutton', { name: 'Rotation' });
    fireEvent.change(field, { target: { value: '0.25turn' } });
    fireEvent.blur(field);
    expect(onChange.mock.calls[0][1]).toBeCloseTo(Math.PI / 2);
    fireEvent.change(field, { target: { value: '30°' } });
    fireEvent.blur(field);
    expect(onChange.mock.calls[1][1]).toBeCloseTo(Math.PI / 6);
  });

  it('commits nothing for a unit it does not accept', () => {
    const onChange = renderRotation({}, Math.PI / 4);
    const field = screen.getByRole('spinbutton', { name: 'Rotation' });
    fireEvent.change(field, { target: { value: '12mm' } });
    fireEvent.blur(field);
    expect(onChange).not.toHaveBeenCalled();
    expect(field).toHaveValue('45');
  });

  it('names the unit beside the field', () => {
    renderRotation({}, Math.PI / 4);
    expect(screen.getByText('°')).toBeInTheDocument();
  });

  it('gives a slider the display range and converts what it reports back', () => {
    const onChange = renderRotation(
      { control: 'slider', min: 0, max: Math.PI * 2, step: Math.PI / 180 },
      Math.PI / 4,
    );
    const slider = screen.getByRole('slider', { name: 'Rotation' });
    expect(slider).toHaveAttribute('min', '0');
    expect(slider).toHaveAttribute('max', '360');
    expect(slider).toHaveAttribute('step', '1');
    expect(slider).toHaveValue('45');
    fireEvent.change(slider, { target: { value: '90' } });
    expect(onChange.mock.calls[0][1]).toBeCloseTo(Math.PI / 2);
  });

  it('leaves a unitless number leaf in the unit it stores', () => {
    const onChange = vi.fn();
    render(
      <PrefsForm
        schema={{
          name: 'root',
          children: {
            layout: {
              name: 'Layout',
              children: {
                width: { kind: 'number', name: 'Width', description: '', default: 0, min: 0, max: 100 },
              },
            },
          },
        }}
        values={{ layout: { width: 12 } }}
        onChange={onChange}
      />,
    );
    const field = screen.getByRole('spinbutton', { name: 'Width' });
    expect(field).toHaveValue('12');
    fireEvent.change(field, { target: { value: '34' } });
    fireEvent.blur(field);
    expect(onChange).toHaveBeenCalledWith('layout.width', 34);
    expect(screen.queryByText('°')).toBeNull();
  });
});

describe('PrefsForm — inherited leaves', () => {
  const LOOKS: PrefGroup = {
    name: 'Looks',
    children: {
      defaults: {
        name: 'Defaults',
        children: {
          glow: { kind: 'number', name: 'Glow', description: 'Halo size.', default: 2, min: 0, max: 10 },
        },
      },
      window: {
        name: 'Window',
        children: {
          glow: { kind: 'number', name: 'Glow', description: 'Halo size.', default: 2, min: 0, max: 10 },
        },
      },
    },
  };
  const values = { defaults: { glow: 4 }, window: { glow: 4 } };
  const props = {
    schema: LOOKS,
    values,
    auto: new Set(['window.glow']),
    canInherit: (path: string) => !path.startsWith('defaults.'),
    inheritHint: () => 'from Defaults',
  };
  const fields = () => screen.getAllByRole('spinbutton', { name: 'Glow' }) as HTMLInputElement[];

  it('draws an inherited leaf with its control, showing the value it was given, and a hint', () => {
    render(<PrefsForm {...props} onChange={() => {}} onAutoChange={() => {}} />);
    const [, windowGlow] = fields();
    expect(windowGlow.value).toBe('4');
    expect(screen.getAllByText('from Defaults')).toHaveLength(1);
    expect(windowGlow.closest('label')?.className).toMatch(/rowAutoInherited/);
  });

  it('pins an inherited leaf through onChange when its control is edited', () => {
    const onChange = vi.fn();
    render(<PrefsForm {...props} onChange={onChange} onAutoChange={() => {}} />);
    const [, windowGlow] = fields();
    fireEvent.change(windowGlow, { target: { value: '7' } });
    fireEvent.blur(windowGlow);
    expect(onChange).toHaveBeenCalledWith('window.glow', 7);
  });

  it('toggles inheritance from the label of a leaf that can inherit, and only there', () => {
    const onAutoChange = vi.fn();
    render(<PrefsForm {...props} values={{ ...values }} onChange={() => {}} onAutoChange={onAutoChange} />);
    const toggles = screen.getAllByRole('button', { name: 'Pin Glow' });
    // Defaults' row refuses inheritance, so only the window's label toggles.
    expect(toggles).toHaveLength(1);
    expect(toggles[0].getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(toggles[0]);
    expect(onAutoChange).toHaveBeenCalledWith('window.glow', false);
  });

  it('gives a manual leaf no toggle', () => {
    const schema: PrefGroup = {
      name: 'Looks',
      children: { glow: { kind: 'number', name: 'Glow', description: '', default: 2, manual: true } },
    };
    render(<PrefsForm schema={schema} values={{}} onChange={() => {}} onAutoChange={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Pin Glow' })).toBeNull();
  });

  it('unpins a pinned leaf from its label', () => {
    const onAutoChange = vi.fn();
    render(
      <PrefsForm {...props} auto={new Set()} onChange={() => {}} onAutoChange={onAutoChange} />,
    );
    const toggle = screen.getByRole('button', { name: 'Pin Glow' });
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByText('from Defaults')).toBeNull();
    fireEvent.click(toggle);
    expect(onAutoChange).toHaveBeenCalledWith('window.glow', true);
  });

  it('draws plain labels with no onAutoChange, and tells a custom renderer the truth', () => {
    const seen: PrefRenderContext[] = [];
    const schema: PrefGroup = {
      name: 'Looks',
      children: { tint: { kind: 'swatch', name: 'Tint', description: '', default: 'red' } },
    };
    render(
      <PrefsForm
        schema={schema}
        auto={new Set(['tint'])}
        onChange={() => {}}
        renderers={{ swatch: (ctx) => (seen.push(ctx), <span>swatch</span>) }}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Pin Tint' })).toBeNull();
    expect(seen.at(-1)?.auto).toBe(true);
  });

  it('threads the same props through PrefsDialog', () => {
    const onAutoChange = vi.fn();
    render(
      <PrefsDialog
        isOpen
        onOpenChange={() => {}}
        {...props}
        onChange={() => {}}
        onAutoChange={onAutoChange}
      />,
    );
    expect(screen.getByText('from Defaults')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Pin Glow' }));
    expect(onAutoChange).toHaveBeenCalledWith('window.glow', false);
  });
});

describe('PrefsForm rows side by side', () => {
  it('gives a leaf whose value is a list the full width, and leaves a scalar in its column', () => {
    render(
      <PrefsForm layout="rail" rowsAcross={2} values={{}} onChange={() => {}}
        renderers={{ list: () => <span>globs</span> }}
        schema={{ name: 'Prefs', children: { icons: { name: 'Icons', children: {
          paths: { kind: 'list', name: 'Draw as icons', description: '', default: ['**/dist'] },
          size: { kind: 'number', name: 'Size', description: '', default: 1 },
        } } } }}
      />,
    );
    const slot = (text: string) => screen.getByText(text).closest('[class*="rowSlot"]');
    expect(slot('Draw as icons')).toHaveAttribute('data-wide');
    expect(slot('Size')).not.toHaveAttribute('data-wide');
  });
});

describe('PrefsForm changed rows', () => {
  it('marks the label of each row the caller names as changed, and no other', () => {
    const schema: PrefGroup = { name: 'Root', children: {
      a: { kind: 'boolean', name: 'Alpha', description: '', default: false },
      b: { kind: 'boolean', name: 'Beta', description: '', default: false },
    } };
    render(<PrefsForm schema={schema} values={{}} onChange={() => {}} changed={new Set(['b'])} />);
    expect(screen.getByRole('checkbox', { name: 'Beta' }).closest('[data-changed]')).not.toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Alpha' }).closest('[data-changed]')).toBeNull();
  });
});

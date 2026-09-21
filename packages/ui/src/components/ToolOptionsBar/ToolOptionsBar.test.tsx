import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ToolPrefGroup } from '@weasel-js/core';
import { ToolOptionsBar } from './ToolOptionsBar';

describe('ToolOptionsBar', () => {
  it('renders its label and children', () => {
    render(
      <ToolOptionsBar label="Text">
        <button>B</button>
      </ToolOptionsBar>,
    );
    expect(screen.getByRole('toolbar', { name: /text/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'B' })).toBeInTheDocument();
  });

  it('renders as an empty reserved row with no children', () => {
    render(<ToolOptionsBar />);
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });
});

const optionsSchema: ToolPrefGroup = {
  name: 'Text',
  children: {
    size: { kind: 'number', name: 'Size', description: 'Type size.', default: 12, min: 1 },
    tracking: {
      kind: 'number',
      name: 'Tracking',
      description: 'Letter spacing.',
      short: 'VA',
      default: 0,
    },
    bold: {
      kind: 'boolean',
      name: 'Bold',
      description: 'Heavier weight.',
      short: 'B',
      control: 'toggle',
      pair: 'Style',
      default: false,
    },
    italic: {
      kind: 'boolean',
      name: 'Italic',
      description: 'Sloped face.',
      short: 'I',
      control: 'toggle',
      pair: 'Style',
      default: false,
    },
    align: {
      kind: 'enum',
      name: 'Align',
      description: 'Where the line sits.',
      default: 'left',
      control: 'select',
      options: [
        { value: 'left', label: 'Left' },
        { value: 'right', label: 'Right' },
      ],
    },
    advanced: {
      name: 'Advanced',
      children: { kerning: { kind: 'number', name: 'Kerning', description: 'Pair spacing.', default: 0 } },
    },
    secret: { kind: 'boolean', name: 'Secret', description: 'Not shown.', default: false, hidden: true },
  },
};

describe('ToolOptionsBar driven by a schema', () => {
  it('draws a control for every visible leaf', () => {
    render(<ToolOptionsBar label="Text" schema={optionsSchema} values={{ size: 12 }} onChange={vi.fn()} />);
    expect(screen.getByLabelText('Size')).toBeInTheDocument();
    expect(screen.getByLabelText('Align')).toBeInTheDocument();
    expect(screen.queryByLabelText('Secret')).toBeNull();
  });

  it('addresses a nested group’s leaf by dotted path', () => {
    const onChange = vi.fn();
    render(
      <ToolOptionsBar
        schema={optionsSchema}
        values={{ 'advanced.kerning': 3 }}
        onChange={onChange}
      />,
    );
    const field = screen.getByLabelText('Kerning');
    fireEvent.change(field, { target: { value: '5' } });
    fireEvent.blur(field);
    expect(onChange).toHaveBeenCalledWith('advanced.kerning', 5);
  });

  it('collapses a run of paired toggles into one segmented bar', () => {
    render(<ToolOptionsBar schema={optionsSchema} values={{}} onChange={vi.fn()} />);
    const bar = screen.getByRole('group', { name: 'Style' });
    expect(within(bar).getByRole('button', { name: 'Bold' })).toBeInTheDocument();
    expect(within(bar).getByRole('button', { name: 'Italic' })).toBeInTheDocument();
  });

  it('writes a flag through the path it was declared at', () => {
    const onChange = vi.fn();
    render(<ToolOptionsBar schema={optionsSchema} values={{ bold: false }} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
    expect(onChange).toHaveBeenCalledWith('bold', true);
  });

  it('keeps arbitrary children alongside the schema', () => {
    render(
      <ToolOptionsBar schema={optionsSchema} values={{}} onChange={vi.fn()}>
        <button>Loupe</button>
      </ToolOptionsBar>,
    );
    expect(screen.getByLabelText('Size')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Loupe' })).toBeInTheDocument();
  });

  it('draws a path whose sources disagree as mixed', () => {
    render(
      <ToolOptionsBar
        schema={optionsSchema}
        values={{ size: 12 }}
        mixed={new Set(['size'])}
        onChange={vi.fn()}
      />,
    );
    expect((screen.getByLabelText('Size') as HTMLInputElement).value).toBe('');
  });
});

describe('ToolOptionsBar labels', () => {
  it('labels a control with its short name, falling back to its full one', () => {
    render(<ToolOptionsBar schema={optionsSchema} values={{}} onChange={vi.fn()} />);
    // `short` wins where a leaf has one, because the strip is one line.
    expect(screen.getByText('VA')).toBeInTheDocument();
    expect(screen.queryByText('Tracking')).toBeNull();
    expect(screen.getByText('Size')).toBeInTheDocument();
  });

  it('leaves a flag run unlabeled — its segments carry their own names', () => {
    render(<ToolOptionsBar schema={optionsSchema} values={{}} onChange={vi.fn()} />);
    expect(screen.queryByText('Style')).toBeNull();
  });

  it('keeps the label out of the accessible name, which stays the full one', () => {
    render(<ToolOptionsBar schema={optionsSchema} values={{}} onChange={vi.fn()} />);
    expect(screen.getByLabelText('Tracking')).toBeInTheDocument();
  });
});

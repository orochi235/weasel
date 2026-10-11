import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlPanel } from './ControlPanel';

const schema = resolveConfigSchema(
  f.schema({
    size: f.number(3).label('Size'),
    note: f.label('Sizes are in world units.').describe('Zoom does not change them.'),
    rule: f.separator(),
    turn: f.number(0).label('Turn'),
  }),
  [],
);

describe('<ControlPanel> label and separator', () => {
  it('builds leaves that hold no value', () => {
    expect(schema.group.children).toMatchObject({
      note: { kind: 'label', name: 'Sizes are in world units.', default: undefined },
      rule: { kind: 'separator', name: '', default: undefined },
    });
  });

  it('draws the label as its text and its note, once, and the separator as a rule, between the rows around them', () => {
    const { container } = render(<ControlPanel schema={schema} config={{ size: 3, turn: 0 }} setConfig={vi.fn()} />);
    expect(screen.getAllByText('Sizes are in world units.')).toHaveLength(1);
    expect(screen.getByText('Zoom does not change them.')).toBeInTheDocument();
    expect(screen.getByRole('separator').tagName).toBe('HR');
    expect(container.textContent).not.toMatch(/no renderer|unknown/i);
    const order = [...container.querySelectorAll('input, hr')].map((el) => el.getAttribute('aria-label') ?? el.tagName);
    expect(order).toEqual(['Size', 'HR', 'Turn']);
  });
});

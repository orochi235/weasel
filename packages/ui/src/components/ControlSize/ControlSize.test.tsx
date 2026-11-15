import { describe, expect, it } from 'vitest';
import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import { Button } from '../Button';
import { Bar } from '../Bar';
import { SegmentedBar } from '../Segmented';
import { CycleButton, COLOR_MODE_OPTIONS } from '../CycleButton';
import { ToolOptionsBar } from '../ToolOptionsBar';
import { Input } from '../Input';
import { TextArea } from '../TextArea';
import { NumberField, UnitField } from '../NumberField';
import { Select } from '../Select';
import f from '../Field/Field.module.css';
import z from '../Field/fieldSize.module.css';
import { ControlSizeScope } from './ControlSize';
import type { ControlSize } from './ControlSize';

const ITEMS = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }];

describe('ControlSizeScope', () => {
  it('sizes the buttons inside it', () => {
    render(<ControlSizeScope size="sm"><Button>Go</Button></ControlSizeScope>);
    expect(screen.getByRole('button', { name: 'Go' }).className).toMatch(/size_sm/);
  });

  it("leaves a control's own size alone", () => {
    render(<ControlSizeScope size="sm"><Button size="md">Go</Button></ControlSizeScope>);
    expect(screen.getByRole('button', { name: 'Go' }).className).toMatch(/size_md/);
  });

  it('gives way to a nearer scope', () => {
    render(<ControlSizeScope size="sm"><ControlSizeScope size="md"><Button>Go</Button></ControlSizeScope></ControlSizeScope>);
    expect(screen.getByRole('button', { name: 'Go' }).className).toMatch(/size_md/);
  });

  it('reaches a segmented bar', () => {
    render(<ControlSizeScope size="sm"><SegmentedBar aria-label="Pick" items={ITEMS} value="a" onChange={() => {}} /></ControlSizeScope>);
    expect(screen.getByRole('radiogroup', { name: 'Pick' }).className).toMatch(/size_sm/);
  });

  it("keeps a control's own default with no scope, and yields it to one", () => {
    const { rerender } = render(<CycleButton value="auto" onChange={() => {}} options={COLOR_MODE_OPTIONS} aria-label="Theme" />);
    expect(screen.getByRole('button').className).toMatch(/size_sm/);
    rerender(<ControlSizeScope size="md"><CycleButton value="auto" onChange={() => {}} options={COLOR_MODE_OPTIONS} aria-label="Theme" /></ControlSizeScope>);
    expect(screen.getByRole('button').className).toMatch(/size_md/);
  });
});

type Sized = { size?: ControlSize };
const fields: Array<[string, (p: Sized) => ReactElement]> = [
  ['Input', (p) => <Input aria-label="F" {...p} />],
  ['TextArea', (p) => <TextArea aria-label="F" {...p} />],
  ['NumberField', (p) => <NumberField aria-label="F" {...p} />],
  ['UnitField', (p) => <UnitField aria-label="F" value={1} onChange={() => {}} {...p} />],
  ['Select', (p) => <Select aria-label="F" options={ITEMS} {...p} />],
];

describe.each(fields)('a %s', (_, make) => {
  const sizeOf = (container: HTMLElement) => {
    const root = container.querySelector(`.${f.field}`)!;
    return root.classList.contains(z.sm) ? 'sm' : root.classList.contains(z.md) ? 'md' : undefined;
  };

  it("takes no size of its own unscoped and unsized, so its container's height holds", () => {
    expect(sizeOf(render(make({})).container)).toBeUndefined();
  });

  it('takes the nearest scope', () => {
    const { container } = render(
      <ControlSizeScope size="md"><ControlSizeScope size="sm">{make({})}</ControlSizeScope></ControlSizeScope>,
    );
    expect(sizeOf(container)).toBe('sm');
  });

  it('keeps its own size inside a scope', () => {
    expect(sizeOf(render(<ControlSizeScope size="sm">{make({ size: 'md' })}</ControlSizeScope>).container)).toBe('md');
  });

  it("takes a container's size", () => {
    expect(sizeOf(render(<Bar label="T" size="sm">{make({})}</Bar>).container)).toBe('sm');
  });
});

describe("a container's size", () => {
  it('reaches the buttons in a Bar', () => {
    render(
      <Bar label="T" size="sm">
        <Button onClick={() => {}}>Undo</Button>
      </Bar>,
    );
    expect(screen.getByRole('button', { name: 'Undo' }).className).toMatch(/size_sm/);
  });

  it('is the scope a Bar inside one takes, with no size of its own', () => {
    render(
      <ControlSizeScope size="sm">
        <Bar label="T"><Button onClick={() => {}}>Undo</Button></Bar>
      </ControlSizeScope>,
    );
    expect(screen.getByRole('toolbar', { name: 'T' }).className).toMatch(/sm/);
    expect(screen.getByRole('button', { name: 'Undo' }).className).toMatch(/size_sm/);
  });

  it('reaches the children of a ToolOptionsBar', () => {
    render(<ToolOptionsBar label="Text" size="sm"><Button>B</Button></ToolOptionsBar>);
    expect(screen.getByRole('button', { name: 'B' }).className).toMatch(/size_sm/);
  });
});

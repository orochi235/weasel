import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../Button';
import { Bar } from '../Bar';
import { SegmentedBar } from '../Segmented';
import { CycleButton, COLOR_MODE_OPTIONS } from '../CycleButton';
import { ToolOptionsBar } from '../ToolOptionsBar';
import { Density } from './Density';

const ITEMS = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }];

describe('Density', () => {
  it('sizes the buttons inside it', () => {
    render(<Density size="sm"><Button>Go</Button></Density>);
    expect(screen.getByRole('button', { name: 'Go' }).className).toMatch(/size_sm/);
  });

  it("leaves a control's own size alone", () => {
    render(<Density size="sm"><Button size="md">Go</Button></Density>);
    expect(screen.getByRole('button', { name: 'Go' }).className).toMatch(/size_md/);
  });

  it('gives way to a nearer scope', () => {
    render(<Density size="sm"><Density size="md"><Button>Go</Button></Density></Density>);
    expect(screen.getByRole('button', { name: 'Go' }).className).toMatch(/size_md/);
  });

  it('reaches a segmented bar', () => {
    render(<Density size="sm"><SegmentedBar aria-label="Pick" items={ITEMS} value="a" onChange={() => {}} /></Density>);
    expect(screen.getByRole('radiogroup', { name: 'Pick' }).className).toMatch(/size_sm/);
  });

  it("keeps a control's own default with no scope, and yields it to one", () => {
    const { rerender } = render(<CycleButton value="auto" onChange={() => {}} options={COLOR_MODE_OPTIONS} aria-label="Theme" />);
    expect(screen.getByRole('button').className).toMatch(/size_sm/);
    rerender(<Density size="md"><CycleButton value="auto" onChange={() => {}} options={COLOR_MODE_OPTIONS} aria-label="Theme" /></Density>);
    expect(screen.getByRole('button').className).toMatch(/size_md/);
  });
});

describe('a container\'s size', () => {
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
      <Density size="sm">
        <Bar label="T"><Button onClick={() => {}}>Undo</Button></Bar>
      </Density>,
    );
    expect(screen.getByRole('toolbar', { name: 'T' }).className).toMatch(/sm/);
    expect(screen.getByRole('button', { name: 'Undo' }).className).toMatch(/size_sm/);
  });

  it('reaches the children of a ToolOptionsBar', () => {
    render(<ToolOptionsBar label="Text" size="sm"><Button>B</Button></ToolOptionsBar>);
    expect(screen.getByRole('button', { name: 'B' }).className).toMatch(/size_sm/);
  });
});

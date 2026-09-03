/**
 * Declaring `annotations` is what provides the drawing palette and the hook —
 * the same "a capability provides the chrome" rule the other capabilities
 * follow. The overlay's own geometry is covered in
 * `annotations/Annotations.overlay.test.tsx`.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { useAnnotations, useAnnotationsOptional } from '../annotations/AnnotationsContext';
import type { AnnotationsApi } from '../annotations/types';
import { defineInstrument } from '../instrument/defineInstrument';
import { Lab } from '../lab/Lab';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => null,
  ) as unknown as HTMLCanvasElement['getContext'];
});

let api: AnnotationsApi | null = null;

function Pane() {
  api = useAnnotations();
  return <div data-testid="pane" data-marks={api.query().length} />;
}

function marks(): AnnotationsApi {
  if (!api) throw new Error('no annotations api');
  return api;
}

const annotating = defineInstrument<Record<string, never>, Record<string, never>>({
  name: 'Annotating',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => <Pane />,
  annotations: {
    targets: () => [{ id: 'pane', ref: { current: null }, content: { w: 200, h: 100 } }],
  },
});

function PlainPane() {
  const api = useAnnotationsOptional();
  return <div data-testid="plain" data-has-api={String(api !== null)} />;
}

const plain = defineInstrument<Record<string, never>, Record<string, never>>({
  name: 'Plain',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => <PlainPane />,
});

describe('an instrument that declares annotations', () => {
  it('gets a drawing palette', () => {
    render(<Lab instruments={[annotating]} defaultInstrument="Annotating" />);
    for (const label of ['Select', 'Freehand', 'Line', 'Arrow', 'Rectangle', 'Ellipse', 'Text']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }
  });

  it('puts the store in reach of its own render', () => {
    render(<Lab instruments={[annotating]} defaultInstrument="Annotating" />);
    expect(screen.getByTestId('pane').dataset.marks).toBe('0');
  });

  it('starts in select, so a first click does not draw', () => {
    render(<Lab instruments={[annotating]} defaultInstrument="Annotating" />);
    expect(screen.getByRole('button', { name: 'Select' }).getAttribute('aria-current')).toBe(
      'true',
    );
  });
});

describe('the trial undo chrome over marks', () => {
  it('gets undo and redo without the instrument declaring `undo`', () => {
    // Weasel history is the authority for marks, so the capability that
    // creates them is what earns the buttons.
    render(<Lab instruments={[annotating]} defaultInstrument="Annotating" />);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Redo' })).toBeTruthy();
  });

  it('takes back a mark, and puts it back', () => {
    render(<Lab instruments={[annotating]} defaultInstrument="Annotating" />);
    const undo = screen.getByRole('button', { name: 'Undo' });
    expect(undo.getAttribute('aria-disabled') ?? undo.getAttribute('disabled')).not.toBeNull();

    act(() => {
      marks().add({ target: 'pane', kind: 'rect', frac: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } });
    });
    expect(screen.getByTestId('pane').dataset.marks).toBe('1');

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    });
    expect(screen.getByTestId('pane').dataset.marks).toBe('0');

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
    });
    expect(screen.getByTestId('pane').dataset.marks).toBe('1');
  });

  it('lists the marks in a sidebar panel', () => {
    render(<Lab instruments={[annotating]} defaultInstrument="Annotating" />);
    expect(screen.getByText('Marks')).toBeTruthy();
    act(() => {
      marks().add({ target: 'pane', kind: 'line', frac: { x: 0, y: 0, w: 0.5, h: 0 } });
    });
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });
});

describe('an instrument that declares none', () => {
  it('gets no store and no palette', () => {
    render(<Lab instruments={[plain]} defaultInstrument="Plain" />);
    expect(screen.getByTestId('plain').dataset.hasApi).toBe('false');
    expect(screen.queryByRole('button', { name: 'Rectangle' })).toBeNull();
  });
});

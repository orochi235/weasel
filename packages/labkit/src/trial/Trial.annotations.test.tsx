/**
 * Declaring `annotations` is what provides the drawing palette and the hook —
 * the same "a capability provides the chrome" rule the other capabilities
 * follow. The overlay's own geometry is covered in
 * `annotations/Annotations.overlay.test.tsx`.
 */
import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { useAnnotations, useAnnotationsOptional } from '../annotations/AnnotationsContext';
import { defineInstrument } from '../instrument/defineInstrument';
import { Lab } from '../lab/Lab';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => null,
  ) as unknown as HTMLCanvasElement['getContext'];
});

function Pane() {
  const api = useAnnotations();
  return <div data-testid="pane" data-marks={api.query().length} />;
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

describe('an instrument that declares none', () => {
  it('gets no store and no palette', () => {
    render(<Lab instruments={[plain]} defaultInstrument="Plain" />);
    expect(screen.getByTestId('plain').dataset.hasApi).toBe('false');
    expect(screen.queryByRole('button', { name: 'Rectangle' })).toBeNull();
  });
});

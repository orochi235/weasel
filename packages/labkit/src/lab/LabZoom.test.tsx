import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { defineInstrument } from '../instrument/defineInstrument';
import { Lab } from './Lab';
import { LabContext, type LabContextValue } from './LabContext';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => null,
  ) as unknown as HTMLCanvasElement['getContext'];
});

const staged = defineInstrument<Record<string, never>, Record<string, never>>({
  name: 'Staged',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => <div data-testid="art" />,
  stage: {
    size: { width: 240, height: 160 },
    initialView: { zoom: 1, pan: { x: 0, y: 0 } },
    maxZoom: 1.5,
  },
});

const plain = defineInstrument<Record<string, never>, Record<string, never>>({
  name: 'Plain',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => <div data-testid="plain" />,
});

let lab: LabContextValue | null = null;
function Capture({ children }: { children?: ReactNode }) {
  return (
    <LabContext.Consumer>
      {(value) => {
        lab = value;
        return children ?? null;
      }}
    </LabContext.Consumer>
  );
}

const zoomBar = () => within(screen.getByRole('toolbar', { name: 'Zoom' }));
const readout = () => zoomBar().getByRole('button', { name: /^Zoom \d+%|^Zoom unavailable/ });
const press = (name: string) =>
  act(() => {
    fireEvent.click(zoomBar().getByRole('button', { name }));
  });

const MOD = /mac/i.test(navigator.platform || navigator.userAgent)
  ? { metaKey: true }
  : { ctrlKey: true };
function key(k: string): boolean {
  let prevented = false;
  act(() => {
    prevented = !fireEvent.keyDown(window, { key: k, ...MOD });
  });
  return prevented;
}

function stageZoom(container: HTMLElement, index = 0): number {
  const el = container.querySelectorAll<HTMLElement>('.lk-stage__content')[index];
  if (!el) throw new Error('no stage content');
  return Number(el.style.getPropertyValue('--lk-stage-zoom'));
}

describe("the lab header's zoom controls", () => {
  it('step the focused trial through its camera and read its zoom back', () => {
    const { container } = render(<Lab instruments={[staged]} defaultInstrument="Staged" />);
    expect(readout()).toHaveTextContent('100%');
    press('Zoom in');
    expect(stageZoom(container)).toBeCloseTo(1.25);
    expect(readout()).toHaveTextContent('125%');
    press('Zoom out');
    expect(stageZoom(container)).toBeCloseTo(1);
    press('Zoom out');
    expect(readout()).toHaveTextContent('80%');
  });

  it('reset to actual size from the readout', () => {
    const { container } = render(<Lab instruments={[staged]} defaultInstrument="Staged" />);
    press('Zoom out');
    press('Zoom out');
    act(() => {
      fireEvent.click(readout());
    });
    expect(stageZoom(container)).toBe(1);
    expect(readout()).toHaveTextContent('100%');
  });

  it("stop at the camera's own limit, and say so", () => {
    const { container } = render(<Lab instruments={[staged]} defaultInstrument="Staged" />);
    press('Zoom in');
    press('Zoom in');
    expect(stageZoom(container)).toBe(1.5);
    expect(zoomBar().getByRole('button', { name: 'Zoom in' })).toBeDisabled();
    expect(zoomBar().getByRole('button', { name: 'Zoom out' })).toBeEnabled();
  });

  it('answer Mod+=, Mod+- and Mod+0, claiming the key from the browser', () => {
    const { container } = render(<Lab instruments={[staged]} defaultInstrument="Staged" />);
    expect(key('=')).toBe(true);
    expect(stageZoom(container)).toBeCloseTo(1.25);
    key('-');
    key('-');
    expect(stageZoom(container)).toBeCloseTo(0.8);
    key('0');
    expect(stageZoom(container)).toBe(1);
  });

  it('go inert over a trial with no camera, and leave its keys to the browser', () => {
    render(<Lab instruments={[plain]} defaultInstrument="Plain" />);
    for (const name of ['Zoom out', 'Zoom in']) {
      expect(zoomBar().getByRole('button', { name })).toBeDisabled();
    }
    expect(readout()).toBeDisabled();
    expect(readout()).toHaveTextContent('–');
    expect(key('=')).toBe(false);
  });

  it('follow the focus from trial to trial', () => {
    const { container } = render(
      <Lab instruments={[staged, plain]} defaultInstrument="Staged">
        <Capture />
      </Lab>,
    );
    act(() => lab?.addTrial('Staged'));
    act(() => lab?.addTrial('Plain'));
    const [first, second, third] = lab?.trials.map((t) => t.id) ?? [];
    expect(zoomBar().getByRole('button', { name: 'Zoom in' })).toBeDisabled();

    act(() => lab?.focusTrial(second ?? ''));
    press('Zoom out');
    expect(stageZoom(container, 1)).toBeCloseTo(0.8);
    expect(stageZoom(container, 0)).toBe(1);
    expect(readout()).toHaveTextContent('80%');

    act(() => lab?.focusTrial(first ?? ''));
    expect(readout()).toHaveTextContent('100%');
    key('=');
    expect(stageZoom(container, 0)).toBeCloseTo(1.25);
    expect(stageZoom(container, 1)).toBeCloseTo(0.8);

    act(() => lab?.focusTrial(third ?? ''));
    expect(readout()).toBeDisabled();
  });

  it('are left out when the lab says so', () => {
    render(<Lab instruments={[staged]} defaultInstrument="Staged" zoom={false} />);
    expect(screen.queryByRole('toolbar', { name: 'Zoom' })).toBeNull();
  });
});

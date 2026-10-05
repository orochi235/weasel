/**
 * The React-rendered overlay for `hud-vs-dom.spec.ts`, which bundles it with
 * React's production build and serves it to the fixture page.
 *
 * Each label is a memoized component keyed by index, so a frame re-renders
 * only the labels whose text or position changed — what a careful consumer
 * writes. A frame commits with `flushSync` from inside the rAF callback: left
 * to the scheduler, the commit lands in a later task and the overlay trails
 * the canvas by a frame.
 */
import { memo, useState, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';

export interface LabelState { text: string; x: number; y: number }

const Label = memo(function Label({ text, x, y }: LabelState): ReactElement {
  return <span className="label" style={{ transform: `translate(${x}px, ${y}px)` }}>{text}</span>;
});

export function mountReactOverlay(el: HTMLElement, initial: LabelState[]) {
  let setLabels: ((l: LabelState[]) => void) | null = null;
  function Overlay(): ReactElement {
    const [labels, set] = useState(initial);
    setLabels = set;
    return <>{labels.map((l, i) => <Label key={i} text={l.text} x={l.x} y={l.y} />)}</>;
  }
  const root = createRoot(el);
  flushSync(() => root.render(<Overlay />));
  return {
    update(labels: LabelState[]) { flushSync(() => setLabels!(labels)); },
    unmount() { root.unmount(); },
  };
}

import { useMemo, type ReactElement } from 'react';
import type { ActionDeps, CanvasExtensionApi, ContributionFrameCtx, ImmediateInvoker } from '@weasel-js/core';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { createRulers } from '@weasel-js/guides';
import { IMPERIAL_INCHES, METRIC_MM, type UnitScope } from '@weasel-js/quantity';
import { Rulers } from '@weasel-js/ui/components/Rulers';
import s from './Rulers.stories.module.css';

const BOARD: UnitScope = { system: IMPERIAL_INCHES };

interface PreviewProps {
  /** Screen px per world unit. */
  zoom: number;
  /** The document's scope. */
  root: UnitScope;
  /** World x and y at the canvas's top-left. */
  pan: number;
}

/** Rulers as a canvas 480 × 320 at `zoom` would show them, the pointer held at its middle. */
function RulersPreview({ zoom, root, pan }: PreviewProps): ReactElement {
  const rulers = useMemo(() => {
    const r = createRulers({ guides: { addGuide: () => {}, removeGuide: () => {}, getGuides: () => [] }, root });
    const api = { registerLayer: () => () => {}, requestRedraw: () => {}, getSurfaceRect: () => ({ x: 0, y: 0, width: 480, height: 320 }) };
    r.contribution.attach!(api as unknown as CanvasExtensionApi, { get: () => undefined });
    r.contribution.beforePaint!({ view: { x: pan, y: pan, scale: { x: zoom, y: zoom } } } as ContributionFrameCtx);
    const hover = r.contribution.actions!.find((a) => a.id === 'rulers.pointer')!.invoker as ImmediateInvoker;
    hover.run({} as ActionDeps, { world: { x: pan + 240 / zoom, y: pan + 160 / zoom }, over: true } as never);
    return r;
  }, [zoom, root, pan]);
  return <div className={s.frame}><Rulers rulers={rulers} /></div>;
}

const meta: Meta<typeof RulersPreview> = {
  title: 'ui/Rulers',
  component: RulersPreview,
  args: { zoom: 10, root: BOARD, pan: -2 },
};
export default meta;
type Story = StoryObj<typeof RulersPreview>;

/** A board in inches at 10 px an inch, labeled in feet. */
export const Board: Story = {};

/** Zoomed in to 200 px an inch: tenths of an inch. */
export const ZoomedIn: Story = { args: { zoom: 200, pan: -0.1 } };

/** A metric document, at 4 px a millimeter. */
export const Metric: Story = { args: { zoom: 4, root: { system: METRIC_MM }, pan: -5 } };

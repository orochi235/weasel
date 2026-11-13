import type { Meta, StoryObj } from '@weasel-js/forge';
import { defineInstrument, f, Lab, useAnnotations } from '@weasel-js/labkit';
import { useLabChromeContext } from '@weasel-js/labkit/chrome';
import { createRef, useEffect, useMemo } from 'react';

const CONTENT = { w: 320, h: 200 };
const paneRef = createRef<HTMLDivElement>();

/** Arms `tool`, and with `select` adds two marks and selects them, so each story opens in the state it shows. */
function Start({ tool, select }: { tool: string; select: boolean }) {
  const { setActiveTool } = useLabChromeContext();
  const marks = useAnnotations();
  useEffect(() => {
    setActiveTool(tool);
    if (!select || marks.query().length > 0) return;
    const a = marks.add({
      target: 'pane',
      kind: 'rect',
      frac: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 },
      width: 4,
    });
    const b = marks.add({
      target: 'pane',
      kind: 'line',
      frac: { x: 0.5, y: 0.2, w: 0.4, h: 0.5 },
      points: [
        { x: 0.5, y: 0.2 },
        { x: 0.9, y: 0.7 },
      ],
      color: '#0090ff',
    });
    marks.setSelection([a, b]);
  }, [tool, select, setActiveTool, marks]);
  return null;
}

function instrument(tool: string, select: boolean) {
  return defineInstrument({
    name: 'Picture',
    config: f.schema({}),
    initialState: () => ({}),
    render: () => (
      <div ref={paneRef} className="lk-annotation-options-story__pane">
        <Start tool={tool} select={select} />
      </div>
    ),
    annotations: { targets: () => [{ id: 'pane', ref: paneRef, content: CONTENT }] },
  });
}

function Story({ tool, select }: { tool: string; select: boolean }) {
  const instruments = useMemo(() => [instrument(tool, select)], [tool, select]);
  return (
    <div className="lk-annotation-options-story">
      <Lab title="Annotation options" instruments={instruments} opening={['Picture']} />
    </div>
  );
}

const meta: Meta<typeof Story> = {
  title: 'labkit/Annotations/AnnotationOptions',
  component: Story,
};
export default meta;

type S = StoryObj<typeof Story>;

/** A drawing tool: the width and color the next mark is drawn in. */
export const DrawingTool: S = { args: { tool: 'rect', select: false } };

/** Text: its size, and the shared color. */
export const TextTool: S = { args: { tool: 'text', select: false } };

/** Select with two marks selected: their style, color mixed. */
export const Selection: S = { args: { tool: 'select', select: true } };

/** Interact: no palette. */
export const Interact: S = { args: { tool: 'pointer', select: false } };

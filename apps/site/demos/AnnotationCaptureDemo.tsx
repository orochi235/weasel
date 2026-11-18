/**
 * Exporting a lab's picture with its marks on it.
 *
 * The instrument owns the picture and hands it over as markup — an SVG base
 * keeps the whole export vector and rasterizes once at the end. labkit's own
 * toolbar Export panel is one caller; the host panel below is the other, and
 * it is the point of the demo: a lab driving `annotations.capture()` itself
 * and doing what it likes with the blob.
 */
import { defineInstrument, f, Lab, useAnnotations } from '@weasel-js/labkit';
import '@weasel-js/labkit/styles.css';
import { createEmitter } from '@weasel-js/registry';
import { createRef, useCallback, useSyncExternalStore } from 'react';
import 'windease/styles.css';
import { Button } from '@weasel-js/ui/components/Button';

const CONTENT = { width: 240, height: 160 };
const paneRef = createRef<HTMLDivElement>();

/** The last export, from labkit's toolbar Export or the buttons below: `onCapture`
 *  is how a host sees an export it did not start. Module scope because the
 *  capability is declared outside React. */
let latest: { url: string; width: number; height: number } | null = null;
const captured = createEmitter();
function publish(next: typeof latest): void {
  if (latest) URL.revokeObjectURL(latest.url);
  latest = next;
  captured.emit();
}

/** Four flat quadrants and a black dot dead center, so a capture at the wrong
 *  scale or origin puts a mark over the wrong quadrant. The default hue keeps
 *  all four away from the mark color, so a pixel probe never reads the base as a mark. */
function Target({ hue }: { hue: number }) {
  return (
    <svg
      viewBox="0 0 240 160"
      width={CONTENT.width}
      height={CONTENT.height}
      role="img"
      aria-label="Quadrants"
      data-testid="capture-base"
    >
      <title>Quadrants</title>
      <rect x="0" y="0" width="120" height="80" fill={`hsl(${hue} 70% 45%)`} />
      <rect x="120" y="0" width="120" height="80" fill={`hsl(${hue + 90} 70% 45%)`} />
      <rect x="0" y="80" width="120" height="80" fill={`hsl(${hue + 180} 70% 45%)`} />
      <rect x="120" y="80" width="120" height="80" fill={`hsl(${hue + 270} 70% 45%)`} />
      <circle cx="120" cy="80" r="8" fill="#000" />
    </svg>
  );
}

/** A host calling `capture()` itself; labkit hands over a Blob and takes no view on where it goes. */
function CapturePanel() {
  const marks = useAnnotations();
  const shot = useSyncExternalStore(
    captured.subscribe,
    useCallback(() => latest, []),
    () => null,
  );

  // `onCapture` handles the result, as it does for the toolbar's export.
  const run = (format: 'png' | 'svg') => {
    marks.capture('pane', { format, scale: 4 }).catch((err: unknown) => {
      publish(null);
      console.error('[annotation-capture] capture failed', err);
    });
  };

  return (
    <div className="ckd-capture-panel">
      <Button onClick={() => run('png')}>Capture PNG ×4</Button>
      <Button onClick={() => run('svg')}>Capture SVG</Button>
      {shot ? (
        <img
          src={shot.url}
          alt="The last capture"
          data-testid="capture-result"
          data-width={shot.width}
          data-height={shot.height}
        />
      ) : null}
    </div>
  );
}

const inspector = defineInstrument<Record<string, never>, { hue: number }>({
  name: 'Quadrants',
  config: f.schema({ hue: f.number(140).range(0, 300).step(10).slider() }),
  initialState: () => ({}),
  render: ({ config }) => (
    <div className="ckd-capture-stage">
      <div ref={paneRef} data-pane="pane">
        <Target hue={config.hue} />
      </div>
      <CapturePanel />
    </div>
  ),
  annotations: {
    meaning: { statuses: [{ id: 'flagged', label: 'Flagged', color: '#ffffff' }] },
    onCapture: (result) =>
      publish({ url: URL.createObjectURL(result.blob), width: result.width, height: result.height }),
    targets: () => [
      {
        id: 'pane',
        ref: paneRef,
        content: CONTENT,
        positionDependsOn: ['hue'],
        // The pane's own markup. A target declaring no base still exports its
        // marks — on transparency, which fails visibly rather than blank.
        base: () => ({
          kind: 'svg',
          markup: paneRef.current?.querySelector('svg')?.outerHTML ?? '',
        }),
      },
    ],
  },
});

export function AnnotationCaptureDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab
        title="Annotation capture"
        instruments={[inspector]}
      />
    </div>
  );
}

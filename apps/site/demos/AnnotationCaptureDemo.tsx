/**
 * Exporting a lab's picture with its marks on it.
 *
 * The instrument owns the picture and hands it over as markup — an SVG base
 * keeps the whole export vector and rasterizes once at the end. labkit's own
 * toolbar Export panel is one caller; the host panel below is the other, and
 * it is the point of the demo: a lab driving `annotations.capture()` itself
 * and doing what it likes with the blob.
 */
import { defineInstrument, f, Lab, noneAdapter, useAnnotations } from '@weasel-js/labkit';
// In-repo, so the source stylesheet: a consumer imports the built
// `@weasel-js/labkit/styles.css` instead.
import '@weasel-js/labkit/styles.less';
import { createRef, useCallback, useSyncExternalStore } from 'react';
import 'windease/styles.css';

const CONTENT = { w: 240, h: 160 };
const paneRef = createRef<HTMLDivElement>();

/** The last export, wherever it came from.
 *
 *  `onCapture` fires for labkit's own toolbar Export as well as for the
 *  buttons below, which is the whole reason the hook exists: a host cannot
 *  otherwise see an export it did not start. Module scope because the
 *  capability is declared outside React, same as the target refs. */
let latest: { url: string; w: number; h: number } | null = null;
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
function publish(next: typeof latest): void {
  if (latest) URL.revokeObjectURL(latest.url);
  latest = next;
  for (const fn of listeners) fn();
}

/** Four flat quadrants and a black dot dead centre. A capture landing at the
 *  wrong scale or the wrong origin puts a mark over the wrong quadrant, which
 *  a pixel probe can say out loud — the default hue keeps all four away from
 *  the mark colour, so nothing can mistake the base for a mark. */
function Target({ hue }: { hue: number }) {
  return (
    <svg
      viewBox="0 0 240 160"
      width={CONTENT.w}
      height={CONTENT.h}
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

/** A host calling the API for itself: capture, then show what came back. This
 *  is the whole consumer contract — labkit hands over a Blob and takes no view
 *  on where it goes. */
function CapturePanel() {
  const marks = useAnnotations();
  const shot = useSyncExternalStore(
    subscribe,
    useCallback(() => latest, []),
    () => null,
  );

  // Nothing here handles the result: `onCapture` does, and it does the same
  // for an export started from the toolbar.
  const run = (format: 'png' | 'svg') => {
    marks.capture('pane', { format, scale: 4 }).catch((err: unknown) => {
      publish(null);
      console.error('[annotation-capture] capture failed', err);
    });
  };

  return (
    <div className="ckd-capture-panel">
      <button type="button" data-testid="capture-png" onClick={() => run('png')}>
        Capture PNG ×4
      </button>
      <button type="button" data-testid="capture-svg" onClick={() => run('svg')}>
        Capture SVG
      </button>
      {shot ? (
        <img
          src={shot.url}
          alt="The last capture"
          data-testid="capture-result"
          data-width={shot.w}
          data-height={shot.h}
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
      publish({ url: URL.createObjectURL(result.blob), w: result.width, h: result.height }),
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
        defaultInstrument="Quadrants"
        storage={noneAdapter}
      />
    </div>
  );
}

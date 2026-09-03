/**
 * The toolbar's export popover. Marks belong to a target, so any export has to
 * name one — which is why this is a panel and not a bare button.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { AnnotationsContext } from './AnnotationsContext';
import { ExportMenu } from './ExportMenu';
import { createAnnotationStore } from './store';
import type { AnnotationsApi, AnnotationTargetInfo, CaptureOptions } from './types';

const TARGETS: AnnotationTargetInfo[] = [
  { id: 'flat', content: { w: 200, h: 100 } },
  { id: 'shaded', content: { w: 200, h: 100 } },
];

function mount(store: AnnotationsApi | null) {
  return render(
    <AnnotationsContext.Provider value={store}>
      <ExportMenu />
    </AnnotationsContext.Provider>,
  );
}

/** A store whose capture is a spy — the real one needs a browser. */
function spied(): { store: AnnotationsApi; capture: ReturnType<typeof vi.fn> } {
  const store = createAnnotationStore({ targets: () => TARGETS });
  const capture = vi.fn(async (target: string, opts?: CaptureOptions) => ({
    target,
    blob: new Blob(['x'], { type: 'image/png' }),
    format: opts?.format ?? ('png' as const),
    width: 1,
    height: 1,
  }));
  return { store: { ...store, capture } as AnnotationsApi, capture };
}

const open = () => fireEvent.click(screen.getByRole('button', { name: /export/i }));

// Downloading clicks an anchor at an object URL, which jsdom answers with
// "Not implemented: navigation". The real save is asserted in the browser
// spec; here the claim is only which capture the panel asked for.
beforeAll(() => {
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

describe('<ExportMenu>', () => {
  it('renders nothing for a trial whose instrument declares no annotations', () => {
    const { container } = mount(null);
    expect(container).toBeEmptyDOMElement();
  });

  it('offers every target, both formats and the scales', () => {
    mount(spied().store);
    open();
    const targets = screen.getByRole('combobox', { name: /target/i }) as HTMLSelectElement;
    expect([...targets.options].map((o) => o.value)).toEqual(['flat', 'shaded']);
    expect(screen.getByRole('radio', { name: 'PNG' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'SVG' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: '4×' })).toBeTruthy();
  });

  it('captures the target, format and scale the panel is holding', async () => {
    const { store, capture } = spied();
    mount(store);
    open();
    fireEvent.change(screen.getByRole('combobox', { name: /target/i }), {
      target: { value: 'shaded' },
    });
    fireEvent.click(screen.getByRole('radio', { name: 'SVG' }));
    fireEvent.click(screen.getByRole('radio', { name: '4×' }));
    fireEvent.click(screen.getByRole('button', { name: /download/i }));
    await waitFor(() =>
      expect(capture).toHaveBeenCalledWith('shaded', { format: 'svg', scale: 4 }),
    );
  });

  it('says so when a capture fails rather than doing nothing visible', async () => {
    const { store, capture } = spied();
    capture.mockRejectedValueOnce(new Error('the capture canvas is tainted'));
    mount(store);
    open();
    fireEvent.click(screen.getByRole('button', { name: /download/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/tainted/);
  });
});

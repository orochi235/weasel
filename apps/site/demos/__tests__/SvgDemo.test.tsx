import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getPaintKind } from '@weasel-js/paint-kinds';
import { SvgDemo } from '../SvgDemo';

const UNREADABLE = '<svg data-test="unreadable"/>';
vi.mock('@weasel-js/svg', async (importOriginal) => {
  const real = await importOriginal<typeof import('@weasel-js/svg')>();
  return {
    ...real,
    parseSvg: ((source: string, ...rest: unknown[]) => {
      if (source === UNREADABLE) throw new Error('unreadable');
      return (real.parseSvg as (...a: unknown[]) => unknown)(source, ...rest);
    }) as typeof real.parseSvg,
  };
});

const MESH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:wzl="urn:weasel-js:svg" viewBox="0 0 420 320">
  <defs>
    <wzl:meshGradient id="m" gradientUnits="objectBoundingBox">
      <wzl:patch points="0,0 0.33,0 0.67,0 1,0 1,0.33 1,0.67 1,1 0.67,1 0.33,1 0,1 0,0.67 0,0.33" colors="#7fb069 #7ab8d4 #a48bd4 #d4a574"/>
    </wzl:meshGradient>
  </defs>
  <rect x="90" y="60" width="240" height="200" fill="url(#m) #7fb069"/>
</svg>`;

describe('SvgDemo', () => {
  it('writes the def of a paint kind that had not loaded when the source arrived', async () => {
    // Nothing in this file imports `@weasel-js/core/mesh`, so the kind is
    // still behind its loader here.
    expect(getPaintKind('mesh-gradient')).toBeUndefined();
    render(<SvgDemo />);
    fireEvent.change(screen.getByLabelText('SVG source'), { target: { value: MESH_SVG } });
    await waitFor(() => expect(document.querySelector('pre')?.textContent).toContain('<wzl:meshGradient'), { timeout: 10_000 });
    expect(screen.queryByLabelText('serializeSvg warnings')).toBeNull();
  });

  it('reads and writes its mesh preset without a warning either way', async () => {
    render(<SvgDemo />);
    fireEvent.click(screen.getByRole('radio', { name: 'Mesh gradient' }));
    await waitFor(() => expect(document.querySelector('pre')?.textContent).toContain('<wzl:patch'), { timeout: 10_000 });
    expect(screen.queryByLabelText('parseSvg warnings')).toBeNull();
    expect(screen.queryByLabelText('serializeSvg warnings')).toBeNull();
  });

  it('keeps the viewBox of the content it still holds while the source fails to parse', async () => {
    render(<SvgDemo />);
    const source = screen.getByLabelText('SVG source');
    fireEvent.change(source, {
      target: { value: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><rect width="10" height="10"/></svg>' },
    });
    await waitFor(() => expect(document.querySelector('pre')?.textContent).toContain('viewBox="0 0 800 600"'), { timeout: 10_000 });
    fireEvent.change(source, { target: { value: UNREADABLE } });
    expect(await screen.findByLabelText('parseSvg warnings')).toBeTruthy();
    await new Promise((r) => setTimeout(r, 50));
    expect(document.querySelector('pre')?.textContent).toContain('viewBox="0 0 800 600"');
  });
});

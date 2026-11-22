import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AnnotationCaptureDemo } from '../AnnotationCaptureDemo';
import { stubResizeObserver } from './pathEditLabHarness';
import { withIcons } from '../../testIcons';

let minted = 0;
const revoked: string[] = [];
vi.stubGlobal('URL', Object.assign(URL, {
  createObjectURL: () => `blob:capture-${++minted}`,
  revokeObjectURL: (url: string) => { revoked.push(url); },
}));

beforeAll(() => {
  window.history.replaceState(null, '', '/?test=1');
  stubResizeObserver();
});
afterEach(cleanup);

describe('AnnotationCaptureDemo', () => {
  it('revokes its last capture when it unmounts, and the next mount starts with none', async () => {
    const first = await renderSettled(<AnnotationCaptureDemo />, { wrapper: withIcons });
    fireEvent.click(await screen.findByRole('button', { name: 'Capture SVG' }));
    const shot = await screen.findByTestId('capture-result');
    const url = shot.getAttribute('src')!;
    first.unmount();
    expect(revoked).toContain(url);
    await renderSettled(<AnnotationCaptureDemo />, { wrapper: withIcons });
    expect(screen.queryByTestId('capture-result')).toBeNull();
  });

  it('keeps the last good capture when a later one fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await renderSettled(<AnnotationCaptureDemo />, { wrapper: withIcons });
    fireEvent.click(await screen.findByRole('button', { name: 'Capture SVG' }));
    const url = (await screen.findByTestId('capture-result')).getAttribute('src');
    // A base with no markup is one capture rejects.
    screen.getByTestId('capture-base').remove();
    fireEvent.click(screen.getByRole('button', { name: 'Capture SVG' }));
    await waitFor(() => expect(console.error).toHaveBeenCalled());
    expect(screen.getByTestId('capture-result').getAttribute('src')).toBe(url);
  });
});

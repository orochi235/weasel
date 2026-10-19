import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { DEMOS } from '../registry';
import { WeaselDemos } from '../WeaselDemos';
import { renderWithIcons } from '../testIcons';

beforeAll(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  (HTMLCanvasElement.prototype as unknown as { getContext: () => null }).getContext = () => null;
});
afterEach(cleanup);

describe('the demo devtools toggle', () => {
  it('opens the devtools panel beside the demo in a development build', { timeout: 15_000 }, async () => {
    window.history.replaceState(null, '', `/#${DEMOS[0].id}`);
    renderWithIcons(<WeaselDemos />);
    expect(screen.queryByRole('region', { name: 'Devtools' })).toBeNull();
    fireEvent.click(await screen.findByRole('switch', { name: 'Devtools' }));
    // The panel is a lazy chunk, and its first load transforms the whole package.
    expect(await screen.findByRole('region', { name: 'Devtools' }, { timeout: 10_000 })).toBeTruthy();
    fireEvent.click(screen.getByRole('switch', { name: 'Devtools' }));
    expect(screen.queryByRole('region', { name: 'Devtools' })).toBeNull();
  });
});

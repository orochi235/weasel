import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';

const printers: { disposed: boolean }[] = [];
const printed: { disposed: boolean }[] = [];

vi.mock('@weasel-js/p-touch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@weasel-js/p-touch')>()),
  createBrotherPrinter: () => {
    const printer = { disposed: false, dispose() { printer.disposed = true; } };
    printers.push(printer);
    return printer;
  },
  renderLabel: async () => ({ width: 1, height: 1, data: new Uint8ClampedArray(4) }),
  printLabel: async ({ printer }: { printer: { disposed: boolean } }) => {
    printed.push({ disposed: printer.disposed });
    return { hasError: false };
  },
}));

describe('PTouchLabelDemo', () => {
  afterEach(() => { vi.unstubAllGlobals(); printers.length = 0; printed.length = 0; });

  it('prints with a live printer under StrictMode, whose remount disposes the first one', async () => {
    vi.stubGlobal('navigator', { ...navigator, usb: {} });
    vi.resetModules();
    const { PTouchLabelDemo } = await import('../PTouchLabelDemo');
    const { getByRole } = render(<StrictMode><PTouchLabelDemo /></StrictMode>);
    await act(async () => { fireEvent.click(getByRole('button', { name: 'Print' })); });
    expect(printed).toEqual([{ disposed: false }]);
  });
});

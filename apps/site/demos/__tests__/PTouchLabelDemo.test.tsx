import { StrictMode } from 'react';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { PTouchLabelDemo } from '../PTouchLabelDemo';

// The demo reads WebUSB support at import; giving it before the import spares a cold re-import under
// vi.resetModules, which ran past the timeout on a loaded node.
vi.hoisted(() => { Object.defineProperty(navigator, 'usb', { value: {}, configurable: true }); });

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
  afterEach(() => { printers.length = 0; printed.length = 0; });
  afterAll(() => { Reflect.deleteProperty(navigator, 'usb'); });

  it('prints with a live printer under StrictMode, whose remount disposes the first one', async () => {
    const { getByRole } = render(<StrictMode><PTouchLabelDemo /></StrictMode>);
    await act(async () => { fireEvent.click(getByRole('button', { name: 'Print' })); });
    expect(printed).toEqual([{ disposed: false }]);
  });
});

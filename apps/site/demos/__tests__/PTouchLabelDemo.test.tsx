import { StrictMode } from 'react';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { PTouchLabelDemo } from '../PTouchLabelDemo';

// The demo reads WebUSB support at import; giving it before the import spares a cold re-import under
// vi.resetModules, which ran past the timeout on a loaded node.
vi.hoisted(() => { Object.defineProperty(navigator, 'usb', { value: {}, configurable: true }); });

const printers: { disposed: boolean }[] = [];
const printed: { disposed: boolean }[] = [];
const lbx = vi.hoisted(() => ({ fail: null as Error | null }));

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
  sceneToLbx: async (...args: Parameters<typeof import('@weasel-js/p-touch')['sceneToLbx']>) => {
    if (lbx.fail) throw lbx.fail;
    const real = await vi.importActual<typeof import('@weasel-js/p-touch')>('@weasel-js/p-touch');
    return real.sceneToLbx(...args);
  },
}));

describe('PTouchLabelDemo', () => {
  afterEach(() => { printers.length = 0; printed.length = 0; lbx.fail = null; });
  afterAll(() => { Reflect.deleteProperty(navigator, 'usb'); });

  it('prints with a live printer under StrictMode, whose remount disposes the first one', async () => {
    const { getByRole } = render(<StrictMode><PTouchLabelDemo /></StrictMode>);
    await act(async () => { fireEvent.click(getByRole('button', { name: 'Print' })); });
    expect(printed).toEqual([{ disposed: false }]);
  });

  it('shows a failed download on the status line, as it does a failed print', async () => {
    lbx.fail = new Error('no font');
    const { getByRole, findByText } = render(<PTouchLabelDemo />);
    await act(async () => { fireEvent.click(getByRole('button', { name: 'Download .lbx' })); });
    expect(await findByText('Error: no font')).toBeTruthy();
  });
});

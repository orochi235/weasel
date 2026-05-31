import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// vitest 4's jsdom env no longer hoists Storage APIs to globalThis (its
// `KEYS` list omits localStorage/sessionStorage). The real Storage objects
// live on the jsdom instance vitest stashes at `globalThis.jsdom` — pull
// them onto the global so production code can use `localStorage.foo`.
const jsdomWin = (globalThis as { jsdom?: { window: Window } }).jsdom?.window;
if (jsdomWin && typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', { value: jsdomWin.localStorage });
  Object.defineProperty(globalThis, 'sessionStorage', { value: jsdomWin.sessionStorage });
}

afterEach(() => {
  cleanup();
});

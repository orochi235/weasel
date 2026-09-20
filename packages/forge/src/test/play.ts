/**
 * What a CSF `play` function asserts with.
 *
 * A play runs inside the story's frame — a real browser document, driven by
 * `forgeTest` under vitest or by the workshop — so it cannot import `vitest`,
 * whose entry only exists inside a test worker. This module assembles the same
 * `expect` vitest hands a test: chai carrying `@vitest/expect`'s jest-style
 * matchers. Queries and input come from testing-library, which is already
 * browser-only.
 *
 * No jest-dom matchers. They install through `expect.extend`, which wants the
 * matcher state a test worker sets up, and there is none here — the call
 * throws at module scope. Assert on the DOM directly instead:
 * `expect(el.textContent).toBe(…)` for `toHaveTextContent`,
 * `expect(el).not.toBeNull()` for `toBeInTheDocument`.
 */
import { type ExpectStatic, JestAsymmetricMatchers, JestChaiExpect, JestExtend } from '@vitest/expect';
import * as chai from 'chai';

chai.use(JestExtend);
chai.use(JestChaiExpect);
chai.use(JestAsymmetricMatchers);

/** `expect`, with jest's matchers. */
export const expect = chai.expect as unknown as ExpectStatic;

export { screen, waitFor, within } from '@testing-library/dom';
export { default as userEvent } from '@testing-library/user-event';

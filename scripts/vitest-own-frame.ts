/** The part of a Playwright frame this module reads. */
export interface NamedFrame {
  url(): string;
  isDetached(): boolean;
}

/** The part of a Playwright page this module reads. */
export interface FramePage {
  frame(name: string): NamedFrame | null;
}

/** The name vitest gives every test file's iframe. */
const TEST_FRAME = 'vitest-iframe';

/**
 * Wait until the frame vitest's own commands will act on is `testPath`'s. They
 * look the frame up by name, and every test file's iframe has the same one, so
 * while Playwright still lists the previous file's iframe the lookup can return
 * it, and a command evaluating there fails with "Frame was detached".
 */
export async function waitForOwnFrame(
  page: FramePage,
  testPath: string,
  { timeoutMs = 5000, stepMs = 10 }: { timeoutMs?: number; stepMs?: number } = {},
): Promise<void> {
  const id = `iframeId=${encodeURIComponent(testPath)}`;
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const frame = page.frame(TEST_FRAME);
    if (frame && !frame.isDetached() && frame.url().includes(id)) return;
    if (Date.now() > deadline)
      throw new Error(`the "${TEST_FRAME}" frame was still ${frame?.url() ?? 'missing'} after ${timeoutMs} ms, not ${testPath}'s`);
    await new Promise((r) => setTimeout(r, stepMs));
  }
}

type Click = (el: HTMLElement) => Promise<void>;

/** Builds a `choose` that clicks with the caller's `userEvent.click`, so this file imports nothing from vitest/browser. */
export function makeChoose(click: Click) {
  return async (menu: string, row: RegExp): Promise<void> => {
    const bar = document.querySelector('[role="menubar"]')!;
    const title = [...bar.querySelectorAll<HTMLElement>('[role="menuitem"]')]
      .find((el) => el.textContent?.trim() === menu);
    await click(title!);
    const item = [...document.querySelectorAll<HTMLElement>('[role="menu"] [role^="menuitem"]')]
      .find((el) => row.test(el.textContent ?? ''));
    await click(item!);
  };
}

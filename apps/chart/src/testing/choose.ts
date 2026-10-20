import { page, userEvent } from 'vitest/browser';

/** Opens the menu bar's `menu` and clicks the row whose text matches `row`. */
export async function choose(menu: string, row: RegExp): Promise<void> {
  await userEvent.click(page.getByRole('menubar').getByRole('menuitem', { name: menu }));
  const item = [...document.querySelectorAll<HTMLElement>('[role="menu"] [role^="menuitem"]')]
    .find((el) => row.test(el.textContent ?? ''));
  await userEvent.click(item!);
}

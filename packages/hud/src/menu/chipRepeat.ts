import { createStepRepeat, type StepRepeatOptions } from '@weasel-js/ui-logic';
import { menuNumberCanStep, type MenuController, type MenuNumberEntry, type Rect } from '@weasel-js/menu';
import { rowAt, type MenuMetrics } from './drawPanel';
import { chipAt } from './valueRows';

/** A number row's step chip: the row, and which way it steps. */
export interface MenuChip { entry: MenuNumberEntry; dir: 1 | -1 }

/** The topmost of `panels` under (x, y), or -1. */
export function levelAt(panels: readonly Rect[], x: number, y: number): number {
  for (let i = panels.length - 1; i >= 0; i--) {
    const p = panels[i]!;
    if (x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h) return i;
  }
  return -1;
}

/** The step chip under (x, y) of a number row that takes input, or null. */
export function chipUnder(
  c: Pick<MenuController, 'entriesAt'>, panels: readonly Rect[], m: MenuMetrics, x: number, y: number,
): MenuChip | null {
  const level = levelAt(panels, x, y);
  if (level < 0) return null;
  const p = panels[level]!, entries = c.entriesAt(level);
  const index = rowAt(entries, m, y - p.y);
  const entry = index === null ? undefined : entries[index];
  if (entry?.kind !== 'number' || entry.disabled) return null;
  const dir = chipAt(p.w, m, x - p.x);
  return dir === null ? null : { entry, dir };
}

/** A press on a number row's chips: {@link ChipHold.press}, then {@link ChipHold.follow} for each move and the release. */
export interface ChipHold {
  /** Step the chip under (x, y), if any, once now and then repeatedly while it is held. */
  press(x: number, y: number): void;
  /** The pointer is at (x, y), or released at null: the hold ends unless it is still on the held chip. */
  follow(at: { x: number; y: number } | null): void;
  stop(): void;
}

/** Hold-to-repeat on number rows' step chips, timed as a `@weasel-js/ui` number field's steppers are by default.
 *  `under` finds the chip at a point. */
export function createChipHold(
  c: Pick<MenuController, 'spin' | 'numberValue'>, under: (x: number, y: number) => MenuChip | null,
  opts?: StepRepeatOptions,
): ChipHold {
  const from = (e: MenuNumberEntry) => c.numberValue(e) ?? e.min ?? 0;
  const repeat = createStepRepeat<MenuChip>(
    ({ entry, dir }) => { c.spin(entry, dir > 0 ? 'ArrowUp' : 'ArrowDown'); },
    ({ entry, dir }) => entry.disabled === true || !menuNumberCanStep(entry, from(entry), dir),
    opts,
  );
  return {
    press(x, y) {
      const chip = under(x, y);
      if (chip) repeat.start(chip);
    },
    follow(at) {
      const held = repeat.held();
      if (!held) return;
      const chip = at && under(at.x, at.y);
      if (chip?.entry !== held.entry || chip.dir !== held.dir) repeat.stop();
    },
    stop: repeat.stop,
  };
}

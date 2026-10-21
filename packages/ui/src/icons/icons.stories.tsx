import type { Meta, StoryObj } from '@weasel-js/forge';
import { Icon } from './Icon';
import { toIconRef, type IconRef, type IconTable } from '@weasel-js/icons';
import { icons as coreIcons } from '@weasel-js/core/icons';
import { icons as shapeIcons } from '@weasel-js/icons/shapes';
import { ICON_GROUPS, icon } from '../icons.gen';
import { icons as uiIcons } from '../icons.table';
import s from './icons.stories.module.css';

const meta: Meta = { title: 'ui/Icons/Gallery', tags: ['gallery'] };
export default meta;

/** A table's glyphs by group, in the order it lists them. */
function groupsOf(table: IconTable): { label: string; refs: IconRef[] }[] {
  const groups = new Map<string, IconRef[]>();
  for (const [name, glyph] of Object.entries(table.icons)) {
    const refs = groups.get(glyph.group) ?? [];
    refs.push(toIconRef(`${table.namespace}:${name}`)!);
    groups.set(glyph.group, refs);
  }
  return [...groups].map(([label, refs]) => ({ label, refs }));
}

function Sheet({ table = uiIcons, size, proof }: { table?: IconTable; size: number; proof?: boolean }) {
  return (
    <>
      {groupsOf(table).map(({ label, refs }) => (
        <section key={label}>
          <h2 className={s.groupHeading}>{label}</h2>
          <div className={proof ? `${s.sheet} ${s.proof}` : s.sheet}>
            {refs.map((ref) => (
              <figure key={ref}>
                <Icon name={ref} size={size} label={ref} />
                <figcaption>{ref}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

const MARKED = [icon('formPage'), icon('formSection'), icon('core:tune'), icon('layers'), icon('shape:hexagon')];
const MARKS = ICON_GROUPS.find((g) => g.label === 'Marks')?.names.map((n) => icon(n)) ?? [];

function MarkedSheet({ size, proof }: { size: number; proof?: boolean }) {
  return (
    <div className={proof ? `${s.sheet} ${s.proof}` : s.sheet}>
      {MARKED.flatMap((name) => MARKS.map((mark) => (
        <figure key={name + mark}>
          <Icon name={name} mark={mark} size={size} label={`${name}, ${mark}`} />
          <figcaption>{name} + {mark}</figcaption>
        </figure>
      )))}
    </div>
  );
}

/** Each mark set in the corner of a few glyphs, the glyph cleared from around it. */
export const MarkedAtChromeSize: StoryObj = { render: () => <MarkedSheet size={20} /> };

/** The tree's size, where a slot is some six pixels across. */
export const MarkedAtTreeSize: StoryObj = { render: () => <MarkedSheet size={16} /> };

export const MarkedAtProofSize: StoryObj = { render: () => <MarkedSheet size={160} proof /> };

/** Chrome size — the legibility check, not the design surface. */
export const AtChromeSize: StoryObj = { render: () => <Sheet size={20} /> };

/** CLAUDE.md ("Drawing icons") requires proofing at this size before shipping
 *  a change; a misplaced arrowhead is invisible at 20px. */
export const AtProofSize: StoryObj = { render: () => <Sheet size={160} proof /> };

/** Core's glyphs — its tools, actions and leaves — at the size the toolbar draws them. */
export const CoreAtChromeSize: StoryObj = { render: () => <Sheet table={coreIcons} size={20} /> };

export const CoreAtProofSize: StoryObj = { render: () => <Sheet table={coreIcons} size={160} proof /> };

/** The plain shapes `@weasel-js/icons` draws, which every package may name. */
export const ShapesAtChromeSize: StoryObj = { render: () => <Sheet table={shapeIcons} size={20} /> };

export const ShapesAtProofSize: StoryObj = { render: () => <Sheet table={shapeIcons} size={160} proof /> };

/**
 * Both theme modes at once.
 *
 * The workshop's mode global applies one mode to the whole frame, so every
 * other story here shows an icon against one surface at a time. These two
 * panels set `data-wzl-mode` per panel, which is the only way to see both at
 * once.
 */
export const BothModes: StoryObj = {
  render: () => (
    <>
      <div data-wzl-mode="light" className={s.modePanel}>
        <Sheet size={20} />
        <Sheet table={coreIcons} size={20} />
        <Sheet table={shapeIcons} size={20} />
      </div>
      <div data-wzl-mode="dark" className={s.modePanel}>
        <Sheet size={20} />
        <Sheet table={coreIcons} size={20} />
        <Sheet table={shapeIcons} size={20} />
      </div>
    </>
  ),
};

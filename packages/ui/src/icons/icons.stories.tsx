import type { Meta, StoryObj } from '@storybook/react-vite';
import { Icon } from './Icon';
import { ICON_PATHS, type IconName } from './paths';
import {
  SelectIcon, LassoIcon, RectIcon, EllipseIcon, ImageIcon, EyedropperIcon,
  LineIcon, ArrowIcon, PolygonIcon, StarIcon, PencilIcon, TextIcon, PenIcon,
  HandIcon, UnknownIcon,
} from './index';
import s from './icons.stories.module.css';

const meta: Meta = { title: 'weasel-ui/icons/Gallery' };
export default meta;

const NAMES = Object.keys(ICON_PATHS) as IconName[];

/**
 * The tool glyphs, which live in `@weasel-js/core` because core needs them for
 * `Tool.presentation.icon` defaults and cannot depend on this package. They
 * are re-exported here as one import site for the whole set, so a catalog that
 * showed only `ICON_PATHS` would be showing half of it.
 */
const TOOL_ICONS = {
  SelectIcon, LassoIcon, RectIcon, EllipseIcon, ImageIcon, EyedropperIcon,
  LineIcon, ArrowIcon, PolygonIcon, StarIcon, PencilIcon, TextIcon, PenIcon,
  HandIcon, UnknownIcon,
} as const;

function ToolSheet({ size, proof }: { size: number; proof?: boolean }) {
  return (
    <div className={proof ? `${s.sheet} ${s.proof}` : s.sheet}>
      {Object.entries(TOOL_ICONS).map(([name, Glyph]) => (
        <figure key={name}>
          <Glyph size={size} />
          <figcaption>{name}</figcaption>
        </figure>
      ))}
    </div>
  );
}

function Sheet({ size, proof }: { size: number; proof?: boolean }) {
  return (
    <div className={proof ? `${s.sheet} ${s.proof}` : s.sheet}>
      {NAMES.map((n) => (
        <figure key={n}>
          <Icon name={n} size={size} label={n} />
          <figcaption>{n}</figcaption>
        </figure>
      ))}
    </div>
  );
}

/** Chrome size — the legibility check, not the design surface. */
export const AtChromeSize: StoryObj = { render: () => <Sheet size={20} /> };

/** CLAUDE.md ("Drawing icons") requires proofing at this size before shipping
 *  a change; a misplaced arrowhead is invisible at 20px. */
export const AtProofSize: StoryObj = { render: () => <Sheet size={160} proof /> };

/** The core-owned half of the set, at the size the toolbar draws it. */
export const ToolIconsAtChromeSize: StoryObj = { render: () => <ToolSheet size={20} /> };

export const ToolIconsAtProofSize: StoryObj = { render: () => <ToolSheet size={160} proof /> };

/**
 * Both theme modes at once.
 *
 * Storybook's theme global does not switch weasel's theme — `tokens.css` keys
 * its mode blocks off `data-wzl-mode`, which nothing in a bare `@weasel-js/ui`
 * story sets, so every other story here renders on the `:root` dark default in
 * both modes. These two panels set it by hand, which is the only way to see an
 * icon against the surface it will actually sit on.
 */
export const BothModes: StoryObj = {
  render: () => (
    <>
      <div data-wzl-mode="light" className={s.modePanel}>
        <Sheet size={20} />
        <ToolSheet size={20} />
      </div>
      <div data-wzl-mode="dark" className={s.modePanel}>
        <Sheet size={20} />
        <ToolSheet size={20} />
      </div>
    </>
  ),
};

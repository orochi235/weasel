import type { Meta, StoryObj } from '@storybook/react-vite';
import { Icon } from './Icon';
import { ICON_PATHS, type IconName } from './paths';

const meta: Meta = { title: 'weasel-ui/icons/Gallery' };
export default meta;

const NAMES = Object.keys(ICON_PATHS) as IconName[];

function Sheet({ size }: { size: number }) {
  return (
    <div className="wzl-icon-sheet">
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
export const AtProofSize: StoryObj = { render: () => <Sheet size={160} /> };

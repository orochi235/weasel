import { Icon } from '../Icon/Icon';
import { icon } from '../../icons.gen';

/**
 * Spread into a `Button` for the kit's close, dismiss, or remove button: a quiet icon-only ghost showing the
 * `close` glyph, which brightens when pointed at. `aria-label` says what the press closes or removes.
 *
 * ```tsx
 * <Button {...CLOSE_BUTTON_PROPS} aria-label="Close dialog" onClick={close} />
 * ```
 */
export const CLOSE_BUTTON_PROPS = {
  variant: 'ghost',
  emphasis: 'low',
  size: 'sm',
  iconOnly: true,
  children: <Icon name={icon('close')} size={16} />,
} as const;

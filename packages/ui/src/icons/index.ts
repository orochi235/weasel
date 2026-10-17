export { Icon, isFillable } from './Icon';
export type { IconProps } from './Icon';
export { actionIcon } from './actionIcon';
export { iconFromData } from './iconFromData';
export { resolveIcon } from './resolveIcon';
// Carries ui's IconName augmentation into the published declarations, so a package built
// against them can write `ui:` names.
export type { UiIconName } from '../icons.gen';

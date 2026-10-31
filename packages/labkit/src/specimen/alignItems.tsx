import { Icon } from '@weasel-js/ui/components/Icon';
import { icon } from '../icons.gen';

/** Left, center and right as glyph segments, for the specimen's segmented controls. */
export const ALIGN_ITEMS = [
  {
    value: 'left',
    label: <Icon name={icon('core:textAlignLeft')} size={16} />,
    ariaLabel: 'Left',
    tooltip: 'Left',
  },
  {
    value: 'center',
    label: <Icon name={icon('core:textAlignCenter')} size={16} />,
    ariaLabel: 'Center',
    tooltip: 'Center',
  },
  {
    value: 'right',
    label: <Icon name={icon('core:textAlignRight')} size={16} />,
    ariaLabel: 'Right',
    tooltip: 'Right',
  },
];

import { icons as coreIcons } from '@weasel-js/core/icons';
import { icons as editingIcons } from '@weasel-js/editing/icons';
import type { IconTable } from '@weasel-js/icons';
import { icons as shapeIcons } from '@weasel-js/icons/shapes';
import { icons as paintKindIcons } from '@weasel-js/paint-kinds/icons';
import { icons as uiIcons } from '@weasel-js/ui/icons';

/** Core's, editing's, the shapes', the paint kinds' and ui's icon tables, whole: for a registry that should hold every kit glyph, such as a workshop's or a test's. */
export const kitIcons: readonly IconTable[] = [coreIcons, editingIcons, shapeIcons, paintKindIcons, uiIcons];

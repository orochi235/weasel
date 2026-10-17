import icons from 'virtual:weasel-icons';
import { icon } from './consumer/icons.gen';
import { icon as fx } from './icons.gen';

// @ts-expect-error The fixture's fx module declares no IconName augmentation.
const ring = icon('fx:ring');
Object.assign(globalThis, { seen: [icons, fx('dot'), ring] });

import icons from 'virtual:weasel-icons';
import { star } from '@fx/lib';
import { icon } from './icons.gen';

Object.assign(globalThis, { seen: [icons, star, icon('dot')], load: () => import('virtual:weasel-icons/all') });

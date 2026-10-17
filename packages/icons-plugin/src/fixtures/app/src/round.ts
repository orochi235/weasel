import { star } from '@fx/lib';
import { icon } from './icons.gen';

Object.assign(globalThis, { seen: [star, icon('dot')], load: () => import('virtual:weasel-icons/round') });

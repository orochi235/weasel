import icons from 'virtual:weasel-icons';
// @ts-expect-error The alias is set only in the test's bundler config.
import { icon } from '#gen/icons.gen';

Object.assign(globalThis, { seen: [icons, icon('ring')] });

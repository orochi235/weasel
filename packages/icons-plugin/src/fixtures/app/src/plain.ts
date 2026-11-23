import { plain } from '../node_modules/@fx/lib/dist/plain.sfc';

Object.assign(globalThis, { seen: [plain], load: () => import('virtual:weasel-icons/all') });

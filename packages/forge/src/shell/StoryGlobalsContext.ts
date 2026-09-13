import { createContext } from 'react';
import type { Globals } from '../protocol/messages';

/** The lab's global values, which a trial's pins override. A change reaches open frames without replacing instruments. */
export const StoryGlobalsContext = createContext<Globals>({});

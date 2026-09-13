import { createContext } from 'react';
import type { Globals } from '../protocol/messages';

/** The globals every story frame under it renders with. A change reaches open frames without replacing instruments. */
export const StoryGlobalsContext = createContext<Globals>({});

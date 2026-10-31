import { useDepSource } from '@weasel-js/routing/react';
import type { NoticesDep } from './notices';

/** Publish the host's notice surface as the `notices` dep, where actions tell
 *  the user something went wrong. Silently does nothing outside a
 *  `<DepRegistryProvider>`. */
export function useNotices(notices: NoticesDep): void {
  useDepSource('notices', () => notices);
}

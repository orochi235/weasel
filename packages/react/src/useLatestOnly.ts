import { createLatest, type Latest } from '@weasel-js/registry';
import { useEffect, useState } from 'react';

/** A {@link Latest} for one component, dropped when it unmounts: an answer that lands after is no one's. */
export function useLatestOnly(): Latest {
  const [latest] = useState(createLatest);
  useEffect(() => latest.drop, [latest]);
  return latest;
}

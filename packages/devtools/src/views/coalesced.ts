/**
 * `run`, called at most one at a time: a call made while one runs folds into a single run after it, so calls
 * faster than `run` settles never queue up behind it.
 */
export function coalesced(run: () => Promise<unknown>): () => void {
  let busy = false;
  let again = false;
  const go = (): void => {
    if (busy) { again = true; return; }
    busy = true;
    const done = (): void => {
      busy = false;
      if (again) { again = false; go(); }
    };
    run().then(done, done);
  };
  return go;
}

/**
 * The `operands` dep as a value a dep source can hold: each read goes to the
 * registry in scope, so a source acts on whatever answers `operands` there now.
 */
import { useMemo } from 'react';
import { useOptionalDepRegistry } from '@weasel-js/routing/react';
import type { OperandsDep } from 'interactions/actions/operands';

/** The registry's `operands`, read on each call; empty, and taking nothing, while none answers. */
export function useLiveOperands(): OperandsDep {
  const registry = useOptionalDepRegistry();
  return useMemo<OperandsDep>(() => ({
    get: () => registry?.get('operands')?.get() ?? [],
    set: (ids) => registry?.get('operands')?.set(ids),
  }), [registry]);
}

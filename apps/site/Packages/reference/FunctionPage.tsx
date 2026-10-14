import type { FunctionSymbol } from '../../../shared/reference';
import { Prose } from '../../Prose';
import { CallDetails } from './Callable';
import { CodeLine } from './CodeLine';
import s from './Reference.module.css';

/** A function: each overload's declaration, what its comment says, and its parameters and result. */
export function FunctionPage({ symbol }: { symbol: FunctionSymbol }) {
  return (
    <>
      {symbol.signatures.map((signature, i) => (
        <div key={i} className={s.overload}>
          <CodeLine code={signature.code} />
          <Prose blocks={signature.doc} />
          <CallDetails params={signature.params} returns={signature.returns} />
        </div>
      ))}
    </>
  );
}

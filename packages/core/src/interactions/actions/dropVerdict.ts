/** A no with a reason: words for the user, shown beside the pointer while a drag is over what refuses it. */
export interface DropRefusal {
  refuse: string;
}

/**
 * The answer to "may this land here?": `true` lands, `false` is a silent no,
 * and a {@link DropRefusal} is a no the user is told about. A drag over a
 * refusal draws its target refused and the reason beside the pointer, and a
 * release there lands nothing.
 */
export type DropVerdict = boolean | DropRefusal;

/** The reason `verdict` gives, or `null` when it lands or says no silently. */
export function refusalOf(verdict: DropVerdict | undefined): string | null {
  return typeof verdict === 'object' && verdict !== null ? verdict.refuse : null;
}

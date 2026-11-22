/** The `payload` an affordance hit carries: what a press handed the actions, as a drag's or an immediate's `affordance`.
 *  Undefined unless it is an object. */
export const payloadOf = (hit: unknown): object | undefined => {
  const payload = typeof hit === 'object' && hit !== null && 'payload' in hit ? hit.payload : undefined;
  return typeof payload === 'object' && payload !== null ? payload : undefined;
};

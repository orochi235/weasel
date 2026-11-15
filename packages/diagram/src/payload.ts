/** The `payload` an affordance hit carries: what a press handed the actions, as a drag's or an immediate's `affordance`. */
export const payloadOf = (hit: unknown): unknown =>
  typeof hit === 'object' && hit !== null && 'payload' in hit ? hit.payload : undefined;

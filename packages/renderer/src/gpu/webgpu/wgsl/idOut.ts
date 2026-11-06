/** The id output every WGSL fragment entry writes beside its color, the
 *  counterpart of `withIdOutput`'s GLSL rewrite: `id.rgb` is the id's three
 *  bytes, `id.a` the least alpha a fragment claims its pixel with. A draw
 *  outside an id frame has no target at location 1, and the write is dropped. */
export const ID_OUT_WGSL = /* wgsl */ `
struct WeaselOut {
  @location(0) color: vec4f,
  @location(1) id: vec4f,
}

fn weasel_out(color: vec4f, id: vec4f) -> WeaselOut {
  var o: WeaselOut;
  o.color = color;
  o.id = select(vec4f(0.0), vec4f(id.rgb, 1.0), color.a > 0.0 && color.a >= id.a);
  return o;
}
`;

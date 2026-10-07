// jsdom 29.0.2 through 30.1.1 re-walked the ancestor chain at every level for a custom
// property no ancestor sets, doubling per level: depth 26 took ~20s, and Select reads
// --wzl-select-align this way. 30.1.2 fixed it; this fails if a jsdom bump brings it back.
describe('jsdom custom-property inheritance', () => {
  it('reads an unset custom property deep in the tree in linear time', () => {
    let el: HTMLElement = document.body;
    for (let i = 0; i < 26; i++) el = el.appendChild(document.createElement('div'));
    expect(getComputedStyle(el).getPropertyValue('--never-set')).toBe('');
    document.body.replaceChildren();
  }, 5000);
});

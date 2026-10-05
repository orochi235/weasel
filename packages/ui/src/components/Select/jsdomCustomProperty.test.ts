// Guards patches/jsdom+30.1.1.patch. Unpatched, jsdom re-walks the ancestor chain at every
// level for a custom property no ancestor sets, doubling per level: depth 26 takes ~20s.
// Select reads --wzl-select-align this way. Delete with the patch once jsdom ships the fix.
describe('jsdom custom-property inheritance', () => {
  it('reads an unset custom property deep in the tree in linear time', () => {
    let el: HTMLElement = document.body;
    for (let i = 0; i < 26; i++) el = el.appendChild(document.createElement('div'));
    expect(getComputedStyle(el).getPropertyValue('--never-set')).toBe('');
    document.body.replaceChildren();
  }, 5000);
});

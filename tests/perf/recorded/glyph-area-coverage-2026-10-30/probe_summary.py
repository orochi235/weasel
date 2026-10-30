import json,sys,os,collections
d=sys.argv[1]
print(f"{'engine':14} {'case':18} {'canvas wobble':>13} {'max|dx|':>8} {'dx range':>15}")
for tag in ['chromium-dpr1','firefox-dpr1','webkit-dpr1','chromium-dpr2','firefox-dpr2','webkit-dpr2']:
  p=os.path.join(d,tag+'.json')
  if not os.path.exists(p): continue
  recs=json.load(open(p)); g=collections.OrderedDict()
  for r in recs:
    c=r['case']
    if c['y']!=20 or (c['x']==20 and any(q['case']['y']!=20 and q['case']['family']==c['family'] and q['case']['fontSize']==c['fontSize'] and q['case'].get('script')==c.get('script') for q in [])): pass
    key=f"{c['fontSize']}{c.get('script','')}{'sc' if c.get('smallCaps') else ''}"
    if c['y']!=20: continue
    g.setdefault(key,{}).setdefault(c['x'],r)
  for k,v in g.items():
    if len(v)<8: continue
    offs=[r['canvasInk']['cx']-x for x,r in v.items()]; dxs=[r['dx'] for r in v.values()]
    print(f"{tag:14} {k:18} {max(offs)-min(offs):13.3f} {max(abs(a) for a in dxs):8.3f} {min(dxs):7.3f}..{max(dxs):6.3f}")

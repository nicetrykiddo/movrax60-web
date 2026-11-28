// The camera positions are the same cloth UVs and orbit angles used to draw
// the editable OpenPencil study. Distances are in the Blender rig's units.
export const stops = [
  {id:'identity', at:0, enter:0},
  {id:'results', at:.26, enter:.20},
  {id:'nullcon', at:.34, enter:.30},
  {id:'ritsec', at:.42, enter:.38},
  {id:'script', at:.50, enter:.46},
  {id:'chronos', at:.58, enter:.54},
  {id:'team', at:.79, enter:.735},
  {id:'contact', at:1, enter:.895},
] as const;

export function filmProgress() {
  const end = document.getElementById('contact');
  if (!end || !document.querySelector('.film[data-playing]')) return 0;
  return Math.max(0, Math.min(1, scrollY / Math.max(1, end.offsetTop)));
}

export function readingIndex(p:number) {
  let i=stops.length-1;
  while(i>0 && p<stops[i].enter) i--;
  return i;
}

const keys = [
  [0,.48,.50,-18,6,7.55,.68,.50], [.16,.34,.33,-9,7,5.38,.71,.51],
  [.26,.16,.095,-5,11,3.38,.70,.62], [.34,.316,.095,4,10,2.78,.71,.61],
  [.42,.472,.095,12,9,2.62,.72,.62], [.50,.628,.095,21,9,2.73,.72,.59],
  [.58,.784,.095,33,11,2.86,.70,.55], [.65,.92,.13,69,13,3.14,.67,.57],
  [.70,.95,.16,108,14,3.22,.67,.56], [.79,.755,.284,151,13,3.40,.70,.51],
  [.87,.74,.32,158,10,3.78,.69,.50], [1,.50,.49,162,7,7.70,.68,.51],
];
function slope(i:number, c:number) {
  if (i===0 || i===keys.length-1) return 0;
  const prev=keys[i-1], cur=keys[i], next=keys[i+1];
  const left=cur[0]-prev[0], right=next[0]-cur[0];
  const a=(cur[c]-prev[c])/left, b=(next[c]-cur[c])/right;
  if (a*b<=0) return 0;
  return 3*(left+right)/((2*right+left)/a+(right+2*left)/b);
}
const slopes=keys.map((key,i)=>key.map((_,c)=>slope(i,c)));

export function cameraPose(p:number, out:number[]) {
  let i=keys.length-2;
  while(i>0 && p<keys[i][0]) i--;
  const a=keys[i], b=keys[i+1], span=b[0]-a[0], t=(p-a[0])/span;
  const t2=t*t,t3=t2*t;
  for(let c=1;c<a.length;c++) out[c-1]=(2*t3-3*t2+1)*a[c]+(t3-2*t2+t)*span*slopes[i][c]
    +(-2*t3+3*t2)*b[c]+(t3-t2)*span*slopes[i+1][c];
}

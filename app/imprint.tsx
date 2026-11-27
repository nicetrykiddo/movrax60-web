// Original guilloché plates, with different lobes and winding for each edition.
export function Imprint({edition = 0}: {edition?: number}) {
  const lines: string[] = [];
  const lobes = [3,5,4,6,2][edition%5];
  for (let ring=0;ring<43;ring++) {
    const t = ring/42;
    const path: string[] = [];
    for (let point=0;point<=120;point++) {
      const a = point*Math.PI/60, phase = t*1.46+edition*.67;
      const r = 38+t*71+(15+12*t)*Math.sin(lobes*a+phase)+8*Math.sin(2*a-phase);
      const x = 150+Math.cos(a)*r+13*Math.sin(2*a+phase);
      const y = 132+Math.sin(a)*r*.74+15*Math.cos(a-phase);
      path.push((point?'L':'M')+x.toFixed(1)+' '+y.toFixed(1));
    }
    lines.push(path.join('')+'Z');
  }
  return <svg className="imprint" viewBox="0 0 300 255" aria-hidden="true" focusable="false">
    <path fill="none" stroke="currentColor" strokeWidth=".74" d={lines.join('')}/></svg>;
}

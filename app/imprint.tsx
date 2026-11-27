// One engraved contour per edition, wound and scaled into a rosette.
export function Imprint({edition = 0}: {edition?: number}) {
  const lobes=[3,5,4,6,2][edition%5], phase=edition*.67;
  const contour=Array.from({length:161},(_,i)=>{
    const a=i*Math.PI/80;
    const radius=96+22*Math.sin(lobes*a+phase)+9*Math.sin(2*a-phase);
    return (i?'L':'M')+(Math.cos(a)*radius).toFixed(1)+' '+(Math.sin(a)*radius*.78).toFixed(1);
  }).join('')+'Z';
  const id='plate-'+edition;
  return <svg className="imprint" viewBox="0 0 300 255" aria-hidden="true" focusable="false">
    <defs><path id={id} d={contour}/></defs>
    <g transform="translate(150 130)" fill="none" stroke="currentColor" strokeWidth=".8">
      {Array.from({length:48},(_,i)=><use key={i} href={'#'+id} transform={'rotate('+i*.94+') scale('+(.34+i*.016)+')'}/>)}
    </g></svg>;
}

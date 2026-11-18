const paths={
 Android:'<path d="m7.1 6.5-1.6-2.6m11.4 2.6 1.6-2.6M3 15a9 9 0 0 1 18 0Z" fill="currentColor"/><circle cx="8" cy="11.2" r=".8" fill="white" stroke="none"/><circle cx="16" cy="11.2" r=".8" fill="white" stroke="none"/>',
 iOS:'<path fill="currentColor" stroke="none" d="M16.1 1.8c.2 1.7-1 3.5-2.6 4.2-.5.2-1 .3-1.6.3-.2-1.6 1-3.5 2.5-4.2.6-.2 1.1-.3 1.7-.3ZM19.9 7.8c-2.8 1.5-3 5.3.2 7-.8 2.2-2.3 5.5-4.3 5.6-1.1.1-1.8-.7-3.3-.7-1.4 0-2.1.7-3.1.7-2.1 0-4.8-4.3-5.3-7.7-.6-3.9 1.6-6.5 4.6-6.7 1.5-.1 2.7.8 3.6.8 1 0 2.6-1 4.3-.8 1.3.1 2.4.7 3.3 1.8Z"/>',
 Windows:'<path stroke="none" fill="currentColor" d="M2 4.7 10.4 3.5v8H2zm9.7-1.4L22 1.8v9.7H11.7zM2 12.8h8.4v8L2 19.6zm9.7 0H22v9.7l-10.3-1.5z"/>',
 macOS:'<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/>',
 key:'<circle cx="8" cy="9" r="5"/><path d="m12 12 8 8 2-2-2-2 1-1-2-2-1 1-3-3"/>',
 recent:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
 shield:'<path d="m12 2 8 3v6c0 5-3.8 8.3-8 11-4.2-2.7-8-6-8-11V5z"/><path d="m8.3 11.8 2.4 2.5 5-5"/>',
 link:'<path d="m10 8 2-2a4 4 0 0 1 6 6l-2 2m-2 2-2 2a4 4 0 0 1-6-6l2-2m1.5 4.5 5-5"/>'
};
export const icon=(id)=>'<svg class="ico" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+paths[id]+'</svg>';
export function artwork(canvas){
 function draw(){
 const w=canvas.clientWidth,h=canvas.clientHeight,d=Math.min(devicePixelRatio||1,2); canvas.width=w*d; canvas.height=h*d;
 const c=canvas.getContext('2d');if(!c)return;c.scale(d,d);
 c.fillStyle='rgba(223,193,153,.19)';for(let x=12;x<w;x+=17)for(let y=9;y<h;y+=17)c.fillRect(x,y,1,1);
 c.save();c.translate(w*.51,h*.5);c.scale(h/205,h/205);c.transform(1,-.16,.28,.76,0,0);
 for(let j=16;j>=0;j--){c.save();c.translate(j*.95,j*2.1-15);c.beginPath();c.moveTo(0,-84);c.bezierCurveTo(20,-71,47,-64,75,-60);c.lineTo(75,-7);c.bezierCurveTo(75,38,45,66,0,90);c.bezierCurveTo(-45,66,-75,38,-75,-7);c.lineTo(-75,-60);c.bezierCurveTo(-47,-64,-20,-71,0,-84);c.closePath();c.fillStyle=j?'#52392b':'#4e372b';c.fill();c.strokeStyle=j?'rgba(217,174,127,.65)':'#e4bd92';c.lineWidth=j?.85:1.6;c.stroke();if(!j){c.save();c.scale(.83,.83);c.strokeStyle='#b88e69';c.stroke();c.restore();c.strokeStyle='#e3c29f';c.lineWidth=3;c.beginPath();c.arc(0,-12,8,0,Math.PI*2);c.stroke();c.beginPath();c.moveTo(0,-4);c.lineTo(0,23);c.lineTo(9,23);c.moveTo(0,15);c.lineTo(7,15);c.stroke()}c.restore()}c.restore();
 }new ResizeObserver(draw).observe(canvas);draw();
}

function luminance(hex){const rgb=hex.replace('#','').match(/.{2}/g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722}
export function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
export function readableInk(shirt,preferred){if(contrast(shirt,preferred)>=4.5)return preferred;return contrast(shirt,'#ffffff')>contrast(shirt,'#20251f')?'#ffffff':'#20251f'}

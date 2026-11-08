/** Original project artwork, v1. No third-party imagery. Paths stay immutable for old drafts. */
export const animals=[
 ['rat','Tý · Chuột'],['ox','Sửu · Trâu'],['tiger','Dần · Hổ'],['cat','Mão · Mèo'],
 ['dragon','Thìn · Rồng'],['snake','Tỵ · Rắn'],['horse','Ngọ · Ngựa'],['goat','Mùi · Dê'],
 ['monkey','Thân · Khỉ'],['rooster','Dậu · Gà'],['dog','Tuất · Chó'],['pig','Hợi · Lợn']
];
export const zodiacs=['Bạch Dương','Kim Ngưu','Song Tử','Cự Giải','Sư Tử','Xử Nữ','Thiên Bình','Bọ Cạp','Nhân Mã','Ma Kết','Bảo Bình','Song Ngư'];
export const animalForYear=year=>animals[((Math.trunc(Number(year))-4)%12+12)%12][0];
const text=(key,label,value='',extra={})=>({key,label,type:'text',value,maxLength:24,...extra});
const choice=(key,label,options,value)=>({key,label,type:'select',options,value:value??options[0][0]});
export const schemas={
 couple:[text('name','Tên thứ nhất','MINH'),text('secondName','Tên thứ hai','AN'),{key:'date',label:'Ngày kỷ niệm (không bắt buộc)',type:'date',value:''},choice('partner','Thiết kế chiếc áo',[['sun','Mặt trời · người thứ nhất'],['moon','Mặt trăng · người thứ hai']])],
 family:[{key:'members',label:'Số thành viên',type:'number',value:3,min:2,max:6},text('familyName','Tên gia đình','NHÀ MÌNH'),choice('role','Chiếc áo dành cho',[['Bố','Bố'],['Mẹ','Mẹ'],['Con 1','Con 1'],['Con 2','Con 2'],['Con 3','Con 3'],['Con 4','Con 4']]),text('name','Tên thành viên (không bắt buộc)','')],
 group:[text('group','Tên nhóm / lớp','LỚP MÌNH'),text('yearText','Niên khóa / năm','2026')],
 name:[text('name','Tên của bạn','MINH ANH'),choice('layout','Cách viết',[['classic','Khung tên cổ điển'],['stack','Hai dòng hiện đại'],['initial','Chữ cái đầu & tên']])],
 date:[{key:'date',label:'Ngày / tháng / năm sinh',type:'date',value:'1996-11-08'},choice('layout','Bố cục',[['calendar','Tờ lịch kỷ niệm'],['vintage','Huy hiệu năm sinh']])],
 animal:[{key:'year',label:'Năm sinh âm lịch',type:'number',value:1996,min:1900,max:2100},choice('animal','Con giáp',animals,'rat')],
 zodiac:[choice('zodiac','Cung của bạn',zodiacs.map((n,i)=>[String(i),n]))],
 number:[choice('number','Con số yêu thích',Array.from({length:9},(_,i)=>[String(i+1),String(i+1)]),'7'),text('name','Tên hoặc biệt danh','')],
 slogan:[choice('slogan','Câu nói',[['coffee','Cà phê rồi tính'],['rest','Nghỉ một chút thôi'],['shine','Hôm nay mình tỏa sáng']])],
 art:[],
 birthday:[{key:'age',label:'Tuổi muốn in',type:'number',value:30,min:1,max:120},text('name','Tên người nhận','BẠN'),text('wish','Lời chúc','TUỔI MỚI RỰC RỠ')],
 blank:[]
};
export function defaults(theme){return Object.fromEntries((schemas[theme]||[]).map(f=>[f.key,f.value]))}
const clean=(s,n=24)=>String(s??'').trim().slice(0,n);
export function normalizePersonal(theme,input={}){
 const fields=schemas[theme]||[],v={...defaults(theme)};
 for(const f of fields){if(input[f.key]===undefined)continue;const x=input[f.key];
 if(f.type==='select'){if(f.options.some(([value])=>value===String(x)))v[f.key]=String(x)}
 else if(f.type==='number')v[f.key]=Math.max(f.min,Math.min(f.max,Math.trunc(Number(x))||Number(f.value)));
 else if(f.type==='date'){if(/^\d{4}-\d{2}-\d{2}$/.test(String(x))&&!Number.isNaN(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x)v[f.key]=String(x);else if(theme==='couple')v[f.key]=''}
 else v[f.key]=clean(x,f.maxLength);
 }if(theme==='family'&&v.role.startsWith('Con')&&Number(v.role.split(' ')[1])>v.members-2)v.role='Bố';return v;
}
const asset=id=>'public/artwork/'+id+'.svg';
export function artworkLayers(p,input={},ink='#293e35'){
 const theme=p.artwork?.id||'blank',v=normalizePersonal(theme,input),out=[];
 const image=(id,w=164,h=w,x=300,y=300)=>out.push({kind:'image',src:asset(id),artworkId:id,vector:true,naturalWidth:4000,x,y,width:w,height:h,angle:0});
 const label=(text,y,width=170,font='Arial',fontSize=22)=>out.push({kind:'text',text:clean(text,120),x:300,y,width,height:fontSize*2,angle:0,color:ink,font,fontSize});
 switch(theme){
 case 'couple':image('couple-'+v.partner,150,150,300,300);label(v.partner==='sun'?v.name:v.secondName,402,160,'Georgia',24);label([v.name,v.secondName].filter(Boolean).join(' + '),435,170,'Arial',16);if(v.date)label(v.date.split('-').reverse().join('.'),465,150,'Arial',15);break;
 case 'family':image('family-'+v.members+'-'+(v.role==='Bố'?0:v.role==='Mẹ'?1:Number(v.role.split(' ')[1])+1),155,155,300,296);label(v.familyName,218,170,'Georgia',20);label(v.role.toLocaleUpperCase('vi')+(v.name?' · '+v.name:''),397,180,'Arial',22);label(v.members+' THÀNH VIÊN · MỘT MÁI NHÀ',433,180,'Arial',14);break;
 case 'group':image('group',150,150,300,294);label(v.group,390,170,'Arial',23);label(v.yearText+' · CÙNG MỘT ĐỘI',425,175,'Arial',16);break;
 case 'name':image('name',180,180,300,315);if(v.layout==='stack'){label(v.name.split(' ').join('\n'),315,155,'Arial',24)}else if(v.layout==='initial'){label(v.name.split(' ').filter(Boolean).map(x=>x[0]).join(''),300,150,'Georgia',38);label(v.name,348,145,'Arial',15)}else label(v.name,315,155,'Georgia',24);label('MỘT CÁI TÊN. MỘT DẤU ẤN.',430,174,'Arial',14);break;
 case 'date':{const [year,month,day]=v.date.split('-');image(v.layout==='vintage'?'vintage':'calendar',172,172,300,302);label(v.layout==='vintage'?year:day,300,130,'Georgia',42);label(v.layout==='vintage'?'NGÀY MÌNH BẮT ĐẦU':'THÁNG '+month+' · '+year,353,155,'Arial',14);label(day+'.'+month+'.'+year,421,164,'Georgia',22);break}
 case 'animal':image('animal-'+v.animal,165,165,300,302);label(animals.find(([id])=>id===v.animal)[1].toLocaleUpperCase('vi'),414,175,'Georgia',22);label(String(v.year),449,130,'Arial',18);break;
 case 'zodiac':image('zodiac-'+v.zodiac,175,175,300,306);label(zodiacs[Number(v.zodiac)].toLocaleUpperCase('vi'),424,180,'Georgia',22);label('DẤU ẤN BẦU TRỜI',454,160,'Arial',14);break;
 case 'number':image('number',173,173,300,309);label(v.number,309,140,'Georgia',66);if(v.name)label(v.name,427,170,'Arial',22);break;
 case 'slogan':image(v.slogan==='coffee'?'coffee':v.slogan==='shine'?'couple-sun':'couple-moon',112,112,300,278);label(({coffee:'CÀ PHÊ\nRỒI TÍNH',rest:'NGHỈ MỘT\nCHÚT THÔI',shine:'HÔM NAY MÌNH\nTỎA SÁNG'})[v.slogan],389,180,'Georgia',27);break;
 case 'art':image('landscape',180,190,300,320);label('NẮNG TRÊN VAI',447,170,'Georgia',18);break;
 case 'birthday':image('birthday',140,140,300,290);label(v.age+'',394,150,'Georgia',44);label(v.name,440,170,'Arial',21);label(v.wish,462,180,'Arial',14);break;
 }
 if(p.type==='polo')for(const l of out){l.width*=.75;l.height*=.75;l.y=365+(l.y-340)*.75;if(l.fontSize)l.fontSize*=.75}return {layers:out,personalization:v};
}

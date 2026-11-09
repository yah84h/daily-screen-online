export type LoopRect={x:number;y:number;w:number;h:number};
type Layout={showClock?:boolean;showBoard?:boolean;showPhoto?:boolean;clockFaceOnly?:boolean;id:string;name:string;description:string;clock:LoopRect;photo:LoopRect;board:LoopRect};
const rect=(x:number,w:number):LoopRect=>({x,y:25,w,h:50});
const slots={clock:22,photo:30,board:32};
const orders=[['clock','photo','board'],['board','photo','clock'],['photo','clock','board'],['board','clock','photo'],['clock','board','photo'],['photo','board','clock']] as const;
export const loopLayouts:Layout[]=[
 {id:'clock-board-balanced',name:'ساعة وتميز · متوازن',description:'بطاقتان متجاورتان دون صورة',showPhoto:false,clock:rect(6,38),photo:rect(46,5),board:rect(49,45)},
 {id:'clock-board-feature',name:'ساعة وتميز · التميز أكبر',description:'لوحة تميز واسعة مع ساعة جانبية',showPhoto:false,clock:rect(5,25),photo:rect(31,5),board:rect(34,61)},
 {id:'clock-only',name:'الساعة فقط · في الوسط',description:'الوقت والتاريخ والحصة في بطاقة وسطية',showBoard:false,showPhoto:false,clock:rect(30,40),photo:rect(5,5),board:rect(5,5)},
 {id:'clock-digital',name:'الساعة فقط · رقمية',description:'ساعة كبيرة مع التاريخ دون تفاصيل الحصة',showBoard:false,showPhoto:false,clockFaceOnly:true,clock:rect(20,60),photo:rect(5,5),board:rect(5,5)},
 {id:'board-only',name:'التميز فقط · في الوسط',description:'لوحة المتصدرين في منتصف الشاشة',showClock:false,showPhoto:false,clock:rect(5,5),photo:rect(5,5),board:rect(27,46)},
 {id:'board-wide',name:'التميز فقط · واسع',description:'مساحة أكبر لأسماء الطلاب والنتائج',showClock:false,showPhoto:false,clock:rect(5,5),photo:rect(5,5),board:rect(15,70)},
 {id:'no-photo',name:'بدون صورة · الساعة يسارًا',description:'الساعة ولوحة التميز فقط',clock:rect(6,35),photo:rect(45,5),board:rect(51,43)},
 {id:'no-photo-reverse',name:'بدون صورة · الساعة يمينًا',description:'لوحة التميز يسارًا والساعة يمينًا',clock:rect(59,35),photo:rect(50,5),board:rect(6,43)},
 {id:'classic',name:'التوزيع الأصلي',description:'الساعة يسارًا والتميز يمينًا والصورة في الوسط',clock:rect(6,25),photo:rect(34,26),board:rect(63,31)},
 ...orders.map((order,i)=>{let x=5;const cells={} as Record<'clock'|'photo'|'board',LoopRect>;for(const key of order){cells[key]=rect(x,slots[key]);x+=slots[key]+3;}return{id:'columns-'+i,name:['ثلاثة أعمدة متوازنة','ثلاثة أعمدة معكوسة','الصورة يسارًا','الصورة يمينًا','التميز في الوسط','الساعة يمينًا'][i],description:order.map(key=>({clock:'الساعة',photo:'الصورة',board:'التميز'})[key]).join(' · '),...cells};}),
 {id:'photo-focus',name:'الصورة هي الأساس',description:'صورة واسعة في الوسط مع بطاقتين جانبيتين',clock:rect(4,20),photo:rect(26,40),board:rect(68,28)}
];
export function loopLayout(id?:string){return loopLayouts.find(layout=>layout.id===(id||'classic'))||loopLayouts.find(layout=>layout.id==='classic')!;}

/** Display only: period calculations remain in 24-hour Riyadh time. */
export function displayClock(now:Date,seconds=true){
 return new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Riyadh',hour:'2-digit',minute:'2-digit',...(seconds?{second:'2-digit' as const}:{}),hourCycle:'h12'}).formatToParts(now).filter(p=>['hour','minute','second'].includes(p.type)||p.type==='literal'&&p.value.includes(':')).map(p=>p.value).join('');
}

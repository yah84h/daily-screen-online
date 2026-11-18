/** Custom HTML designs on the classes background: sandboxing, live fields and asset bundling. */

const POLICY =
  "default-src 'none'; script-src 'unsafe-inline' https:; style-src 'unsafe-inline' https:; font-src https: data:; img-src https: data: blob:; media-src https: data: blob:; connect-src https:; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'";

/** Live values a design can show with {{name}} or data-school-field="name". */
export type LoopHtmlFields = Record<string, string>;

export const LOOP_HTML_FIELDS: [name: string, label: string][] = [
  ['time', 'الوقت'],
  ['date', 'التاريخ'],
  ['hijri', 'التاريخ الهجري'],
  ['school', 'اسم المدرسة'],
  ['period', 'الحصة الحالية'],
  ['periodDetail', 'تفاصيل الحصة'],
  ['countdown', 'المتبقي من الحصة'],
];

const BRIDGE = `(function(){
  var slots=[];
  function scan(){
    var w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),n;
    while((n=w.nextNode())){ if(/\\{\\{\\s*\\w+\\s*\\}\\}/.test(n.nodeValue)) slots.push([n,n.nodeValue]); }
  }
  function apply(d){
    for(var i=0;i<slots.length;i++){ slots[i][0].nodeValue=slots[i][1].replace(/\\{\\{\\s*(\\w+)\\s*\\}\\}/g,function(_,k){return d[k]==null?'':d[k];}); }
    document.querySelectorAll('[data-school-field]').forEach(function(el){ var v=d[el.getAttribute('data-school-field')]; if(v!=null) el.textContent=v; });
    window.school=d;
    dispatchEvent(new CustomEvent('school-data',{detail:d}));
  }
  var last=null;
  addEventListener('message',function(e){
    if(e.source!==parent||!e.data||e.data.type!=='school-loop-html') return;
    last=e.data.payload; if(document.body){ if(!slots.length) scan(); apply(last); }
  });
  addEventListener('DOMContentLoaded',function(){ scan(); if(last) apply(last); });
})();`;

/** Wraps an uploaded design so it can't reach the app, and adds the live-field bridge. */
export function loopHtmlDocument(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('base,meta[http-equiv]').forEach((node) => node.remove());
  const policy = doc.createElement('meta');
  policy.httpEquiv = 'Content-Security-Policy';
  policy.content = POLICY;
  doc.head.prepend(policy);
  const style = doc.createElement('style');
  style.textContent =
    'html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}';
  doc.head.prepend(style);
  const bridge = doc.createElement('script');
  bridge.textContent = BRIDGE;
  doc.head.prepend(bridge);
  return '<!doctype html>' + doc.documentElement.outerHTML;
}

const readText = (f: File) => f.text();
const readData = (f: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(f);
  });
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Matches a reference to `name`, with or without a ./ or folder in front of it. */
const ref = (name: string) =>
  new RegExp(`(["'(=]\\s*)(?:\\.?/)?(?:[\\w.-]+/)*${escape(name)}(?=[?#"')\\s>])`, 'g');

/**
 * Turns an HTML file plus the files it uses (images, fonts, CSS, JS) into one
 * self-contained page, so the design works on the TV without the original folder.
 */
export async function bundleLoopHtml(files: File[]) {
  const page = files.find((f) => /\.html?$/i.test(f.name));
  if (!page) throw new Error('اختر ملف HTML (يمكن اختيار الصور والخطوط معه).');
  let html = await readText(page);
  const others = files.filter((f) => f !== page);
  const data = new Map<string, string>();
  for (const f of others) if (!/\.(css|js|mjs)$/i.test(f.name)) data.set(f.name, await readData(f));
  const inlineData = (text: string) => {
    for (const [name, url] of data) text = text.replace(ref(name), (_, lead) => lead + url);
    return text;
  };
  for (const f of others.filter((f) => /\.css$/i.test(f.name))) {
    const css = inlineData(await readText(f)).replace(/<\/style/gi, '<\\/style');
    html = html.replace(
      new RegExp(`<link[^>]+href=["'](?:\\.?/)?(?:[\\w.-]+/)*${escape(f.name)}["'][^>]*>`, 'gi'),
      () => `<style>${css}</style>`,
    );
  }
  for (const f of others.filter((f) => /\.m?js$/i.test(f.name))) {
    const js = (await readText(f)).replace(/<\/script/gi, '<\\/script');
    html = html.replace(
      new RegExp(
        `<script([^>]*)src=["'](?:\\.?/)?(?:[\\w.-]+/)*${escape(f.name)}["']([^>]*)>\\s*</script>`,
        'gi',
      ),
      (_, a, b) => `<script${a}${b}>${js}</script>`,
    );
  }
  return { name: page.name.replace(/\.html?$/i, ''), html: inlineData(html) };
}

export const LOOP_HTML_EXAMPLE = `<!doctype html>
<html dir="rtl"><head><style>
body{display:grid;place-items:center;font-family:Cairo,sans-serif;color:#fff}
.card{background:linear-gradient(135deg,#2b5389,#5aa0e0);padding:4vh 6vw;border-radius:3vh;text-align:center;box-shadow:0 2vh 6vh #0004}
h1{margin:0;font-size:9vh} p{margin:1vh 0 0;font-size:4vh;opacity:.85}
</style></head><body>
<div class="card"><h1>{{time}}</h1><p>{{period}} · {{date}}</p></div>
</body></html>`;

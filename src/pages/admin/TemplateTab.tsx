import TemplateEditor from '@/components/TemplateEditor';
import { Screen } from '@/components/Screen';
import { useAdmin } from './store';
export function TemplateTab() {
 const {data,content,template,setTemplate,saveDesign,chooseImage,busy}=useAdmin();
 const identity={...template,schoolName:template.schoolName??data?.school.name??'',schoolTagline:template.schoolTagline??data?.school.tagline??'',schoolLogo:template.schoolLogo??data?.school.logo_url??''};
 return <TemplateEditor template={identity} onChange={setTemplate} preview={<Screen content={content} template={{...identity,displayMode:'daily'}} school={data?.school}/>} onSave={saveDesign} upload={key=>chooseImage(key==='schoolLogo'?'schoolLogoTemplate':key as Parameters<typeof chooseImage>[0])} busy={busy||!data}/>;
}

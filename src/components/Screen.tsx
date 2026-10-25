import {displayClock} from '@/lib/clock';
import {syncedTheme} from '@/lib/loopAppearance';
import { mediaSlideshowOf } from '@/lib/slideshow';
import { BackgroundSlideshow } from './BackgroundSlideshow';
import { MediaVideo } from './MediaVideo';
import { LoopScreen } from './loop/LoopScreen';
import { useEffect, useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { defaultSchool, defaultTemplate, type Content, type School, type Template } from '@/lib/types';

type Props = { content: Content; template?: Partial<Template>; school?: School; large?: boolean };

/** العرض المشترك بين المعاينة والقالب والتلفزيون — لا تكرره في مكان آخر. */
export function Screen({ content: c, template, school = defaultSchool, large = false }: Props) {
  const t: Template = syncedTheme({ ...defaultTemplate, ...template });
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  if(t.displayMode==='slideshow') return <div className={'screen screen-slideshow '+(large?'large':'')} style={{background:t.background}}><BackgroundSlideshow template={{...t,slideshow:{...mediaSlideshowOf(t),enabled:true}}}/>{!mediaSlideshowOf(t).images.length&&<div className="media-empty">أضف صورًا لعرض الشرائح</div>}</div>;
  if (t.displayMode === 'loop') return <LoopScreen now={now} template={t} school={school} logo={c.logo || school.logo_url || undefined} large={large}/>;
  const d = c.autoDate || !c.date ? now : new Date(c.date + 'T12:00:00+03:00');
  const logo = c.logo || t.schoolLogo || school.logo_url;
  if(t.displayMode==='media') return <div className={'screen screen-media '+(large?'large':'')} style={{background:t.background,'--media-fit':c.mediaFit||'cover'} as import('react').CSSProperties}>{c.fullMedia ? c.fullType==='video' ? <MediaVideo key={c.fullMedia} src={c.fullMedia} sound={large&&c.videoSound!==false} loop={c.videoLoop!==false} controls={large&&!!c.videoControls}/> : <img src={c.fullMedia} alt="وسائط الشاشة" style={{objectFit:c.mediaFit||'cover'}}/> : <div className="media-empty">اختر صورة أو فيديو من لوحة التحكم</div>}</div>;
  return (
    <div
      className={'screen ' + (large ? 'large' : '')}
      style={{
        background: t.background,
        backgroundImage: t.backgroundImage ? `url(${t.backgroundImage})` : undefined,
        backgroundSize: 'cover',
        color: t.color,
        fontFamily: `${!t.font || t.font==='SchoolArabic' ? 'Cairo' : t.font}, 'Noto Sans Arabic', sans-serif`,
      }}
    >
      <BackgroundSlideshow template={t}/>
      <div className="screen-top">
        <div className="school" style={{left:(t.schoolX??55)+'%',top:(t.schoolY??6)+'%',width:(t.schoolW??39)+'%',fontSize:((t.schoolScale??100)/100)+'cqw'}}>
          {logo ? <img src={logo} alt="" /> : <GraduationCap />}
          <span>
            {t.schoolName??school.name}
            <small>{t.schoolTagline??school.tagline}</small>
          </span>
        </div>
        <div className="screen-date">
          <b>{d.toLocaleDateString('ar-SA-u-ca-gregory', { weekday: 'long', timeZone: 'Asia/Riyadh' })}</b>
          {t.calendar !== 'islamic' && <span>{d.toLocaleDateString('ar-SA-u-ca-gregory', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Riyadh' })}</span>}
          {(t.calendar === 'islamic' || t.calendar === 'both') && (
            <span className="hijri">{d.toLocaleDateString('ar-SA-u-ca-islamic-umalqura-nu-arab', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Riyadh' })}</span>
          )}
        </div>
      </div>
      <div
        key={c.title + c.subtitle + c.body + c.badge}
        className="screen-copy"
        style={{ left: t.textX + '%', top: t.textY + '%', width: t.textW + '%', gap: t.spacing + 'cqw', textAlign: t.align || 'right' }}
      >
        {c.showBadge && (
          <div className="screen-badge" style={{ color: t.accent }}>
            <span />
            {c.badge}
          </div>
        )}
        <h1 style={{ fontSize: (4.7 * t.fontSize) / 100 + 'cqw' }}>{c.title}</h1>
        {c.showSubtitle && <h3>{c.subtitle}</h3>}
        <p>{c.body}</p>
        {c.showQR && c.qr && <img className="qr" src={c.qr} alt="QR" />}
      </div>
      {c.image && (
        <img
          className="screen-image"
          src={c.image}
          alt=""
          style={{ left: t.imageX + '%', top: t.imageY + '%', width: t.imageW + '%', height: t.imageH + '%', borderRadius: t.radius + 'px', objectFit: t.fit }}
        />
      )}
      {c.showSecondary && c.secondary && <img className="secondary" src={c.secondary} alt="" />}
      <div className="screen-footer">
        <span>{c.showFooter ? c.footer : ''}</span>
        <b>
          {displayClock(now,false)}
          <small>جدة</small>
        </b>
      </div>
    </div>
  );
}

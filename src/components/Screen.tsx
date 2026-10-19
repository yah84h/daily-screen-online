import { useEffect, useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { defaultSchool, defaultTemplate, type Content, type School, type Template } from '@/lib/types';

type Props = { content: Content; template?: Partial<Template>; school?: School; large?: boolean };

/** العرض المشترك بين المعاينة والقالب والتلفزيون — لا تكرره في مكان آخر. */
export function Screen({ content: c, template, school = defaultSchool, large = false }: Props) {
  const t: Template = { ...defaultTemplate, ...template };
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  const d = c.autoDate || !c.date ? now : new Date(c.date + 'T12:00:00+03:00');
  const logo = c.logo || school.logo_url;
  return (
    <div
      className={'screen ' + (large ? 'large' : '')}
      style={{
        background: t.background,
        backgroundImage: t.backgroundImage ? `url(${t.backgroundImage})` : undefined,
        backgroundSize: 'cover',
        color: t.color,
        fontFamily: `${t.font || 'Noto Sans Arabic'}, 'Noto Sans Arabic', sans-serif`,
      }}
    >
      <div className="screen-top">
        <div className="school">
          {logo ? <img src={logo} alt="" /> : <GraduationCap />}
          <span>
            {school.name}
            <small>{school.tagline}</small>
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
          {now.toLocaleTimeString('ar-SA-u-ca-gregory', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh' })}
          <small>الرياض</small>
        </b>
      </div>
    </div>
  );
}

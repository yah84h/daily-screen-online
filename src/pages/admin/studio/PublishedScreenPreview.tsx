import { Screen } from '@/components/Screen';
import { defaultTemplate } from '@/lib/types';
import { useAdmin } from '../store';

export function PublishedScreenPreview() {
  const { data } = useAdmin();
  return (
    <section className="remote-published-preview" aria-label="معاينة المحتوى المنشور">
      <div className="remote-section-title">
        <h3>المحتوى المنشور</h3>
        <span>معاينة</span>
      </div>
      {data?.current ? (
        <div className="preview-card">
          <Screen
            content={data.current.content}
            template={{ ...defaultTemplate, ...data.screen.template }}
            school={data.school}
          />
        </div>
      ) : (
        <p className="field-hint">لم يُنشر محتوى لهذه الشاشة بعد.</p>
      )}
      <p className="field-hint">
        معاينة لآخر محتوى منشور، وليست بثًا مصورًا من الجهاز. حالة التشغيل الفعلية في تقارير
        الأجهزة.
      </p>
    </section>
  );
}

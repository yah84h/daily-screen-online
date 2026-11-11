import { ImagePlus, Trash2 } from 'lucide-react';
import { DailyMedia } from '@/components/DailyMedia';
import { DailyMediaEditor } from '../DailyMediaEditor';
import { CropEditor } from '../CropEditor';
import { useAdmin } from '../store';

export function DailyMediaFields() {
  const { content, edit, chooseImage } = useAdmin();
  return (
    <section className="studio-media-fields" aria-label="الصورة والفيديو">
      <button type="button" className="studio-upload" onClick={() => chooseImage('image')}>
        <ImagePlus size={28} />
        <b>{content.image ? 'استبدال الصورة أو الفيديو' : 'اختر صورة أو فيديو'}</b>
        <span>من جهازك · JPG، PNG، WEBP، GIF، MP4 أو WEBM</span>
      </button>
      {content.image && (
        <div className="studio-selected-media">
          <div>
            <DailyMedia
              src={content.image}
              type={content.imageType}
              large={false}
              crop={content.imageCrop}
            />
          </div>
          <span>
            <b>{content.imageType === 'video' ? 'فيديو الشاشة' : 'صورة الشاشة'}</b>
            <small>جاهزة في المعاينة</small>
          </span>
          <button
            type="button"
            className="icon-button"
            aria-label="إزالة الصورة"
            onClick={() => edit('image', '')}
          >
            <Trash2 size={18} />
          </button>
        </div>
      )}
      <DailyMediaEditor />
      {content.image && (
        <CropEditor
          value={content.imageCrop}
          onChange={(value) => edit('imageCrop', value)}
          label="ضبط قص الصورة"
        />
      )}
    </section>
  );
}

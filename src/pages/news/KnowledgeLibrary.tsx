import { useMemo, useState } from 'react';
import { Search, Plus, ExternalLink } from 'lucide-react';
import { techEntries } from '@/lib/techQuotes';
const normalize = (text: string) =>
  text.normalize('NFKD').replace(/\p{M}/gu, '').replace(/[أإآ]/g, 'ا').trim();
export function KnowledgeLibrary({
  onUse,
  disabled = false,
}: {
  onUse?: (text: string) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [kind, setKind] = useState('all');
  const categories = useMemo(() => [...new Set(techEntries.map((entry) => entry.category))], []);
  const entries = techEntries.filter(
    (entry) =>
      (category === 'all' || entry.category === category) &&
      (kind === 'all' || entry.kind === kind) &&
      normalize(entry.text + entry.category + (entry.author || '') + entry.sourceLabel).includes(
        normalize(query),
      ),
  );
  return (
    <section className="news-knowledge" aria-label="الومضات والاقتباسات التقنية">
      <div className="news-knowledge-intro">
        <h2>معرفة تستحق الظهور</h2>
        <p>
          {techEntries.length} ومضة واقتباس مع مصادرها. يمكنك إضافتها كإعلانات ومراجعتها قبل النشر.
        </p>
      </div>
      <div className="news-knowledge-filters">
        <label>
          <Search size={17} />
          بحث
          <input
            aria-label="بحث الومضات والاقتباسات"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="برمجة، أمن، اسم المؤلف…"
          />
        </label>
        <label>
          التصنيف
          <select
            aria-label="تصنيف الومضات"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="all">كل التصنيفات</option>
            {categories.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          النوع
          <select
            aria-label="نوع المعرفة"
            value={kind}
            onChange={(event) => setKind(event.target.value)}
          >
            <option value="all">الومضات والاقتباسات</option>
            <option value="tip">ومضات تعليمية</option>
            <option value="quote">اقتباسات</option>
          </select>
        </label>
      </div>
      <p className="field-hint" role="status">
        {entries.length} نتيجة
      </p>
      <div className="news-knowledge-grid">
        {entries.map((entry) => (
          <article key={entry.id}>
            <small>
              {entry.kind === 'quote' ? 'اقتباس مترجم' : 'ومضة تعليمية'} · {entry.category}
            </small>
            <p>{entry.text}</p>
            {entry.author && <b>{entry.author}</b>}
            <a href={entry.source} target="_blank" rel="noreferrer">
              <ExternalLink size={14} />
              {entry.sourceLabel}
            </a>
            {onUse && (
              <button
                type="button"
                className="button white"
                disabled={disabled}
                onClick={() => onUse(entry.text + (entry.author ? '\n' + entry.author : ''))}
              >
                <Plus size={16} />
                إضافة كإعلان
              </button>
            )}
          </article>
        ))}
      </div>
      {!entries.length && (
        <div className="news-empty">لا توجد نتائج. جرّب تصنيفًا أو كلمة أخرى.</div>
      )}
    </section>
  );
}

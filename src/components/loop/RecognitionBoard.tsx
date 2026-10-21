import { useEffect, useId, useState } from "react";
import { Award } from "lucide-react";
import type {
  RecognitionBoard as Board,
  RecognitionStudent,
} from "@/lib/types";
function StudentPhoto({ student }: { student: RecognitionStudent }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [student.photo]);
  return student.photo && !failed ? (
    <img
      src={student.photo}
      alt=""
      className="recognition-photo"
      onError={() => setFailed(true)}
    />
  ) : (
    <span className="recognition-avatar" aria-hidden="true">
      {student.name.trim().slice(0, 1) || <Award />}
    </span>
  );
}
export function RecognitionBoard({ board }: { board: Board }) {
  const titleId = useId();
  const [page, setPage] = useState(0);
  const students = board.students.filter((s) => s.name.trim()),
    pages = Math.ceil(students.length / 2),
    seconds = Math.max(6, Math.min(30, Number(board.pageSeconds) || 10));
  useEffect(() => {
    if (!board.enabled || pages < 2) return;
    const timer = setInterval(
      () => setPage((p) => (p + 1) % pages),
      seconds * 1000,
    );
    return () => clearInterval(timer);
  }, [pages, seconds, board.enabled]);
  if (!board.enabled || !students.length) return null;
  const current = page % pages,
    items = students.slice(current * 2, current * 2 + 2);
  return (
    <section className="recognition-board" aria-labelledby={titleId}>
      <div className="recognition-heading">
        <Award aria-hidden="true" />
        <div>
          <h2 id={titleId}>{board.title || "نجوم الأسبوع"}</h2>
          {board.subtitle && <p>{board.subtitle}</p>}
        </div>
      </div>
      <div className="recognition-page" key={items.map((s) => s.id).join(":")}>
        {items.map((s) => (
          <div className="recognition-student" key={s.id}>
            <StudentPhoto student={s} />
            <div>
              <h3 title={s.name}>{s.name}</h3>
              {s.achievement && <p title={s.achievement}>{s.achievement}</p>}
            </div>
          </div>
        ))}
      </div>
      {pages > 1 && (
        <span
          className="recognition-pages"
          aria-label={`الصفحة ${current + 1} من ${pages}`}
          dir="ltr"
        >
          {current + 1} / {pages}
        </span>
      )}
    </section>
  );
}

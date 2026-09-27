import type { NoticeListItem } from '@shared/api/types.ts';
import { Link } from 'react-router-dom';
import { eventsByDay } from '../lib/calendar.ts';
import { todayKst } from '../lib/dates.ts';
import { importedEventsByDay } from '../lib/icsImport.ts';
import { useImportedEvents } from '../lib/importedEvents.tsx';
import { useLanguage } from '../lib/language.tsx';
import { useSaved } from '../lib/saved.tsx';
import './MiniCalendar.css';

const DAYS = 7;

/** `today` plus the next 6 days, as YYYY-MM-DD (UTC arithmetic, same as ics.ts/calendar.ts). */
function nextDays(today: string): string[] {
  const out = [today];
  const d = new Date(`${today}T00:00:00Z`);
  for (let i = 1; i < DAYS; i++) {
    d.setUTCDate(d.getUTCDate() + 1);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/**
 * Hero-sized "this week" strip: a dot per day for the student's own saved notices and imported
 * events only — never the whole community's notices, so it's personal, small, and never empty
 * just because nothing happens to be due this week for everyone else.
 */
export function MiniCalendar({ notices }: { notices: NoticeListItem[] }) {
  const { t: all } = useLanguage();
  const t = all.home;
  const { saved } = useSaved();
  const imported = useImportedEvents();
  const today = todayKst();
  const days = nextDays(today);

  const savedByDay = eventsByDay(notices.filter((n) => saved.has(n.id)));
  const importedByDay = importedEventsByDay(imported.events);
  const hasAny = days.some((d) => (savedByDay.get(d)?.length ?? 0) > 0 || (importedByDay.get(d)?.length ?? 0) > 0);

  if (!hasAny) {
    return (
      <div className="mini-cal mini-cal--empty">
        <p className="mini-cal__empty-text">{t.miniCalEmpty}</p>
        <Link to="/calendar" className="pill">
          {t.viewCalendar}
        </Link>
      </div>
    );
  }

  return (
    <div className="mini-cal">
      <div className="mini-cal__head">
        <span className="mini-cal__label">{t.miniCalTitle}</span>
        <span className="mini-cal__legend">
          <i className="mini-cal__dot mini-cal__dot--saved" aria-hidden /> {t.miniCalSaved}
          <i className="mini-cal__dot mini-cal__dot--imported" aria-hidden /> {t.miniCalImported}
        </span>
        <Link to="/calendar" className="mini-cal__link">
          {t.viewCalendar}
        </Link>
      </div>
      <ul className="mini-cal__row">
        {days.map((d) => {
          const weekday = new Date(`${d}T00:00:00Z`).getUTCDay();
          const savedCount = savedByDay.get(d)?.length ?? 0;
          const importedCount = importedByDay.get(d)?.length ?? 0;
          return (
            <li key={d}>
              <Link
                to={`/calendar?date=${d}&month=${d.slice(0, 7)}`}
                className={`mini-cal__cell${d === today ? ' mini-cal__cell--today' : ''}`}
                aria-label={all.calendar.dayLabel(d, savedCount + importedCount)}
              >
                <span className="mini-cal__wd">{all.calendar.weekdays[weekday]}</span>
                <span className="mini-cal__day">{Number(d.slice(8, 10))}</span>
                <span className="mini-cal__dots" aria-hidden>
                  {savedCount > 0 && <i className="mini-cal__dot mini-cal__dot--saved" />}
                  {importedCount > 0 && <i className="mini-cal__dot mini-cal__dot--imported" />}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

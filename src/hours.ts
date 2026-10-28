// Opening hours: are you open now, when do you next open, what are this week's hours.
// Hours are config, not code. Format (see examples/hours.example.json):
//   { "weekly": { "mon": [["09:00","17:00"]], "tue": [...], ... }, "closedDates": ["2026-12-25"] }
// A day with no entry (or an empty list) is closed. Several windows per day are fine (lunch break).

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
type Day = (typeof DAYS)[number];

export interface Hours {
  weekly: Partial<Record<Day, Array<[string, string]>>>;
  closedDates: string[];
}

export function parseHours(raw: unknown): Hours {
  const r = (raw ?? {}) as { weekly?: Record<string, unknown>; closedDates?: unknown };
  const weekly: Hours['weekly'] = {};
  for (const d of DAYS) {
    const wins = r.weekly?.[d];
    if (!Array.isArray(wins)) continue;
    weekly[d] = wins
      .filter((w): w is [string, string] => Array.isArray(w) && typeof w[0] === 'string' && typeof w[1] === 'string' && /^\d{2}:\d{2}$/.test(w[0]) && /^\d{2}:\d{2}$/.test(w[1]))
      .map((w) => [w[0], w[1]] as [string, string]);
  }
  const closedDates = Array.isArray(r.closedDates) ? r.closedDates.filter((x): x is string => typeof x === 'string') : [];
  return { weekly, closedDates };
}

const toMin = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** "9 AM", "5:30 PM", "noon", "midnight", for speaking aloud. */
export function spokenTime(minutes: number): string {
  if (minutes === 720) return 'noon';
  if (minutes === 0 || minutes === 1440) return 'midnight';
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}${m ? ':' + String(m).padStart(2, '0') : ''} ${h24 < 12 ? 'AM' : 'PM'}`;
}

/** The wall-clock parts of an instant in a timezone. */
function localParts(at: Date, tz: string): { day: Day; date: string; minutes: number } {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const p: Record<string, string> = {};
  for (const part of f.formatToParts(at)) p[part.type] = part.value;
  const day = p.weekday.toLowerCase().slice(0, 3) as Day;
  return { day, date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

export interface HoursNow {
  open: boolean;
  /** Plain words the model can use, e.g. "We are closed. We next open Tuesday at 9 AM." */
  say: string;
  /** This week's hours, one line per day, for "what are your hours". */
  week: string[];
}

const DAY_NAMES: Record<Day, string> = { sun: 'Sunday', mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday' };

export function hoursNow(hours: Hours | null, at: Date, tz: string): HoursNow {
  if (!hours) return { open: false, say: 'No opening hours are set up, so do not state any. Take a message.', week: [] };
  const now = localParts(at, tz);
  const closedToday = hours.closedDates.includes(now.date);
  const windows = closedToday ? [] : hours.weekly[now.day] ?? [];
  const inWindow = windows.find(([a, b]) => now.minutes >= toMin(a) && now.minutes < toMin(b));

  const week = [1, 2, 3, 4, 5, 6, 0].map((i) => {
    const d = DAYS[i];
    const w = hours.weekly[d] ?? [];
    return w.length ? `${DAY_NAMES[d]}: ${w.map(([a, b]) => `${spokenTime(toMin(a))} to ${spokenTime(toMin(b))}`).join(', ')}` : `${DAY_NAMES[d]}: closed`;
  });

  if (inWindow) return { open: true, say: `The phones are open now until ${spokenTime(toMin(inWindow[1]))}.`, week };

  // Next opening: later today, then up to 8 days ahead.
  for (let ahead = 0; ahead <= 8; ahead++) {
    const probe = new Date(at.getTime() + ahead * 86_400_000);
    const lp = localParts(probe, tz);
    if (hours.closedDates.includes(lp.date)) continue;
    const wins = (hours.weekly[lp.day] ?? []).filter(([a]) => ahead > 0 || toMin(a) > now.minutes);
    if (wins.length) {
      const when = ahead === 0 ? 'today' : ahead === 1 ? 'tomorrow' : DAY_NAMES[lp.day];
      return { open: false, say: `The phones are closed right now. They next open ${when} at ${spokenTime(toMin(wins[0][0]))}.`, week };
    }
  }
  return { open: false, say: 'The phones are closed right now and no opening time is set. Do not state one.', week };
}

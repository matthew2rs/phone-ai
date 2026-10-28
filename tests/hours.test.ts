import { describe, expect, it } from 'vitest';
import { hoursNow, parseHours, spokenTime } from '../src/hours.js';

const hours = parseHours({ weekly: { mon: [['09:00', '17:00']], tue: [['09:00', '12:00'], ['13:00', '17:00']] }, closedDates: ['2026-11-10'] });
const tz = 'Australia/Sydney';

describe('hours', () => {
  it('speaks times', () => {
    expect(spokenTime(540)).toBe('9 AM');
    expect(spokenTime(17 * 60 + 30)).toBe('5:30 PM');
    expect(spokenTime(720)).toBe('noon');
  });
  it('open inside a window (Mon 12:00 Sydney = 01:00Z)', () => {
    const h = hoursNow(hours, new Date('2026-11-02T01:00:00Z'), tz);
    expect(h.open).toBe(true);
    expect(h.say).toContain('5 PM');
  });
  it('closed in the lunch gap on Tuesday and says when it reopens', () => {
    const afternoon = hoursNow(hours, new Date('2026-11-03T02:30:00Z'), tz); // Tue 13:30 Sydney
    expect(afternoon.open).toBe(true);
    const gap = hoursNow(hours, new Date('2026-11-03T01:30:00Z'), tz); // Tue 12:30 Sydney
    expect(gap.open).toBe(false);
    expect(gap.say).toContain('today at 1 PM');
  });
  it('skips closed dates', () => {
    // Mon 9 Nov 21:00 Sydney. Tue 10 Nov is a closed date, and Wed-Sun have no hours, so the next opening is Mon 16 Nov.
    const h = hoursNow(hours, new Date('2026-11-09T10:00:00Z'), tz);
    expect(h.open).toBe(false);
    expect(h.say).toContain('Monday at 9 AM');
  });
  it('no hours configured: states nothing', () => {
    const h = hoursNow(null, new Date(), tz);
    expect(h.say).toContain('do not state any');
  });
  it('lists the week', () => {
    expect(hoursNow(hours, new Date(), tz).week[0]).toBe('Monday: 9 AM to 5 PM');
  });
});

import { describe, expect, it } from 'vitest';
import { formatNumber, normaliseEmail, normaliseNumber } from '../src/phone.js';

describe('normaliseNumber (AU)', () => {
  it.each([
    ['0491 570 006', '+61491570006'],
    ['0491570006', '+61491570006'],
    ['+61 491 570 006', '+61491570006'],
    ['61491570006', '+61491570006'],
    ['(02) 5550 1234', '+61255501234'],
  ])('accepts %s', (raw, want) => expect(normaliseNumber(raw)).toBe(want));

  it.each(['049157000', '04915700060', '1300 123 456', '0115 570 019', '+1 415 301 4190', 'four oh four', '', null, 42])(
    'refuses %s rather than guessing',
    (raw) => expect(normaliseNumber(raw as unknown)).toBeNull(),
  );
  it('INTL accepts any E.164', () => {
    expect(normaliseNumber('+14155550100', 'INTL')).toBe('+14155550100');
    expect(normaliseNumber('4155550100', 'INTL')).toBeNull();
  });
  it('formats for speech', () => {
    expect(formatNumber('+61491570006')).toBe('0491 570 006');
    expect(formatNumber('+61255501234')).toBe('02 5550 1234');
  });
});

describe('normaliseEmail', () => {
  it('lowercases and trims', () => expect(normaliseEmail(' Sam.Jones@Example.COM ')).toBe('sam.jones@example.com'));
  it.each(['sam@', 'sam example.com', '@example.com', 'sam@example', '', null])('refuses %s', (v) => expect(normaliseEmail(v as unknown)).toBeNull());
});

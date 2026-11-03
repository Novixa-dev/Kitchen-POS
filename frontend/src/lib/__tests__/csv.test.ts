import { describe, expect, it } from 'vitest';
import { toCsv } from '../csv';

describe('toCsv', () => {
  it('joins fields with commas and rows with CRLF, which is what Excel expects', () => {
    expect(toCsv([['a', 'b'], ['c', 'd']])).toBe('a,b\r\nc,d');
  });

  it('quotes a field containing a comma', () => {
    // A dish name like "Chicken, grilled" would otherwise shift every
    // following column by one.
    expect(toCsv([['Chicken, grilled', 10]])).toBe('"Chicken, grilled",10');
  });

  it('doubles an embedded quote, per RFC 4180', () => {
    expect(toCsv([['He said "hi"']])).toBe('"He said ""hi"""');
  });

  it('quotes a field containing a newline', () => {
    expect(toCsv([['line1\nline2']])).toBe('"line1\nline2"');
  });

  it('quotes a field containing a carriage return', () => {
    expect(toCsv([['a\rb']])).toBe('"a\rb"');
  });

  it('leaves a plain field unquoted', () => {
    expect(toCsv([['plain']])).toBe('plain');
  });

  it('renders null and undefined as empty, not as "null"', () => {
    expect(toCsv([[null, undefined, 0]])).toBe(',,0');
  });

  it('passes Arabic text through untouched', () => {
    expect(toCsv([['كبسة لحم', 40]])).toBe('كبسة لحم,40');
  });

  it('renders numbers and booleans without quoting', () => {
    expect(toCsv([[1.5, true, false]])).toBe('1.5,true,false');
  });

  it('returns an empty string for no rows', () => {
    expect(toCsv([])).toBe('');
  });
});

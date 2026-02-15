import { describe, it, expect } from 'vitest';
import { PG_TYPE_CATEGORIES, ALL_PG_TYPES, findPgType } from './pg-types';

describe('PG_TYPE_CATEGORIES', () => {
  it('has all expected categories', () => {
    const labels = PG_TYPE_CATEGORIES.map((c) => c.label);
    expect(labels).toContain('Numeric');
    expect(labels).toContain('Text');
    expect(labels).toContain('Boolean');
    expect(labels).toContain('Date/Time');
    expect(labels).toContain('JSON');
    expect(labels).toContain('UUID');
    expect(labels).toContain('Binary');
    expect(labels).toContain('Network');
    expect(labels).toContain('Other');
  });

  it('every category has at least one type', () => {
    for (const cat of PG_TYPE_CATEGORIES) {
      expect(cat.types.length).toBeGreaterThan(0);
    }
  });

  it('every type has a non-empty name', () => {
    for (const cat of PG_TYPE_CATEGORIES) {
      for (const t of cat.types) {
        expect(t.name.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('ALL_PG_TYPES', () => {
  it('contains all types from all categories', () => {
    const totalFromCategories = PG_TYPE_CATEGORIES.reduce((sum, c) => sum + c.types.length, 0);
    expect(ALL_PG_TYPES.length).toBe(totalFromCategories);
  });

  it('includes common types', () => {
    const names = ALL_PG_TYPES.map((t) => t.name);
    expect(names).toContain('INTEGER');
    expect(names).toContain('TEXT');
    expect(names).toContain('BOOLEAN');
    expect(names).toContain('UUID');
    expect(names).toContain('TIMESTAMP');
    expect(names).toContain('JSONB');
    expect(names).toContain('VARCHAR');
  });
});

describe('findPgType', () => {
  it('finds type by exact name', () => {
    const t = findPgType('INTEGER');
    expect(t).toBeDefined();
    expect(t!.name).toBe('INTEGER');
  });

  it('finds type case-insensitively', () => {
    const t = findPgType('integer');
    expect(t).toBeDefined();
    expect(t!.name).toBe('INTEGER');
  });

  it('returns undefined for unknown type', () => {
    expect(findPgType('NONEXISTENT')).toBeUndefined();
  });

  it('VARCHAR has hasLength=true', () => {
    const t = findPgType('VARCHAR');
    expect(t).toBeDefined();
    expect(t!.hasLength).toBe(true);
  });

  it('NUMERIC has hasPrecision=true', () => {
    const t = findPgType('NUMERIC');
    expect(t).toBeDefined();
    expect(t!.hasPrecision).toBe(true);
  });

  it('TEXT has no length or precision', () => {
    const t = findPgType('TEXT');
    expect(t).toBeDefined();
    expect(t!.hasLength).toBe(false);
    expect(t!.hasPrecision).toBe(false);
  });
});

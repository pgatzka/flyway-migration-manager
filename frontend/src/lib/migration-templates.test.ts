import { describe, it, expect } from 'vitest';
import { TEMPLATE_CATEGORIES, ALL_TEMPLATES, findTemplate } from './migration-templates';

describe('TEMPLATE_CATEGORIES', () => {
  it('has expected categories', () => {
    const labels = TEMPLATE_CATEGORIES.map((c) => c.label);
    expect(labels).toContain('Tables');
    expect(labels).toContain('Patterns');
    expect(labels).toContain('Security');
    expect(labels).toContain('Performance');
    expect(labels).toContain('Enums & Types');
  });

  it('every category has at least one template', () => {
    for (const cat of TEMPLATE_CATEGORIES) {
      expect(cat.templates.length).toBeGreaterThan(0);
    }
  });
});

describe('ALL_TEMPLATES', () => {
  it('contains all templates from all categories', () => {
    const total = TEMPLATE_CATEGORIES.reduce((sum, c) => sum + c.templates.length, 0);
    expect(ALL_TEMPLATES.length).toBe(total);
  });

  it('every template has an id, name, sql, and description', () => {
    for (const t of ALL_TEMPLATES) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.sql.length).toBeGreaterThan(0);
      expect(t.description.length).toBeGreaterThan(0);
    }
  });

  it('all template IDs are unique', () => {
    const ids = ALL_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('findTemplate', () => {
  it('finds template by ID', () => {
    const t = findTemplate('users-table');
    expect(t).toBeDefined();
    expect(t!.name).toBe('Users Table');
  });

  it('returns undefined for unknown ID', () => {
    expect(findTemplate('nonexistent')).toBeUndefined();
  });

  it('users-table template contains CREATE TABLE', () => {
    const t = findTemplate('users-table');
    expect(t!.sql).toContain('CREATE TABLE users');
  });

  it('soft-delete template contains deleted_at', () => {
    const t = findTemplate('soft-delete');
    expect(t!.sql).toContain('deleted_at');
  });
});

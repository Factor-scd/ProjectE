import { describe, it, expect } from '@jest/globals';
import { parseWikilinks, extractLinkTargets, hasWikilinks, formatWikilinkDisplay } from '@/lib/wikilink-parser';

describe('wikilink-parser', () => {
  describe('parseWikilinks', () => {
    it('parses simple [[Title]] links', () => {
      const result = parseWikilinks('Check out [[Meeting Notes]] for details');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        raw: '[[Meeting Notes]]',
        entityType: '',
        title: 'Meeting Notes',
        displayText: null,
      });
    });

    it('parses [[Title|Display]] links', () => {
      const result = parseWikilinks('See [[Long Note Title|this note]]');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        raw: '[[Long Note Title|this note]]',
        entityType: '',
        title: 'Long Note Title',
        displayText: 'this note',
      });
    });

    it('parses [[entity_type:Title]] cross-entity links', () => {
      const result = parseWikilinks('Complete [[task:Buy milk]] and [[habit:Exercise]]');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        raw: '[[task:Buy milk]]',
        entityType: 'task',
        title: 'Buy milk',
        displayText: null,
      });
      expect(result[1]).toEqual({
        raw: '[[habit:Exercise]]',
        entityType: 'habit',
        title: 'Exercise',
        displayText: null,
      });
    });

    it('parses [[entity_type:Title|Display]] links', () => {
      const result = parseWikilinks('See [[project:Stratos|the Stratos project]]');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        raw: '[[project:Stratos|the Stratos project]]',
        entityType: 'project',
        title: 'Stratos',
        displayText: 'the Stratos project',
      });
    });

    it('handles multiple wikilinks in one string', () => {
      const result = parseWikilinks('[[Note A]] and [[task:Task B]] and [[Note C|display]]');
      expect(result).toHaveLength(3);
    });

    it('returns empty array for content with no wikilinks', () => {
      const result = parseWikilinks('Plain text with no links');
      expect(result).toHaveLength(0);
    });

    it('returns empty array for empty content', () => {
      expect(parseWikilinks('')).toHaveLength(0);
    });

    it('handles titles with special characters', () => {
      const result = parseWikilinks('[[Task:Buy milk & eggs!]]');
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Buy milk & eggs!');
    });

    it('trims whitespace from titles', () => {
      const result = parseWikilinks('[[  Spaced Title  ]]');
      expect(result[0].title).toBe('Spaced Title');
    });

    it('handles entity types with underscores', () => {
      const result = parseWikilinks('[[note:My Note]]');
      expect(result[0].entityType).toBe('note');
      expect(result[0].title).toBe('My Note');
    });
  });

  describe('extractLinkTargets', () => {
    it('extracts unique link targets', () => {
      const result = extractLinkTargets('[[Note A]] and [[Note A]] and [[task:Task B]]');
      expect(result).toHaveLength(2);
      expect(result).toContainEqual({ entityType: '', title: 'Note A' });
      expect(result).toContainEqual({ entityType: 'task', title: 'Task B' });
    });

    it('deduplicates identical targets', () => {
      const result = extractLinkTargets('[[Note A]] and [[Note A|display]]');
      expect(result).toHaveLength(1);
    });
  });

  describe('hasWikilinks', () => {
    it('returns true when wikilinks exist', () => {
      expect(hasWikilinks('Text with [[a link]]')).toBe(true);
    });

    it('returns false when no wikilinks exist', () => {
      expect(hasWikilinks('Plain text')).toBe(false);
    });

    it('returns false for empty content', () => {
      expect(hasWikilinks('')).toBe(false);
    });
  });

  describe('formatWikilinkDisplay', () => {
    it('uses display text when available', () => {
      const match = parseWikilinks('[[Title|Display]]')[0];
      expect(formatWikilinkDisplay(match)).toBe('Display');
    });

    it('formats entity links without display text', () => {
      const match = parseWikilinks('[[task:Buy milk]]')[0];
      expect(formatWikilinkDisplay(match)).toBe('task: Buy milk');
    });

    it('returns title for simple note links', () => {
      const match = parseWikilinks('[[Meeting Notes]]')[0];
      expect(formatWikilinkDisplay(match)).toBe('Meeting Notes');
    });
  });
});

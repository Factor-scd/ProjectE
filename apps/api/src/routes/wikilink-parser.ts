/**
 * Wikilink Parser
 *
 * Parses note content for [[wikilink]] patterns:
 * - [[Title]] — links to a note by title
 * - [[Title|Display]] — links to a note with custom display text
 * - [[entity_type:Title]] — cross-entity links (e.g. [[task:Buy milk]], [[habit:Exercise]])
 *
 * Supported entity types: task, habit, project, note, section, tag
 */

export interface WikilinkMatch {
  /** The full matched text including brackets, e.g. "[[Buy milk]]" */
  raw: string;
  /** Entity type prefix (empty for note links), e.g. "task", "habit" */
  entityType: string;
  /** The target title (after entity type prefix), e.g. "Buy milk" */
  title: string;
  /** Optional display text (after | separator), e.g. "Buy milk" */
  displayText: string | null;
}

const WIKILINK_REGEX = /\[\[(?:([a-zA-Z_]+):)?([^\]|]+)(?:\|([^\]]+))?\]\]/g;

/**
 * Parse wikilinks from note content.
 */
export function parseWikilinks(content: string): WikilinkMatch[] {
  const matches: WikilinkMatch[] = [];
  let match: RegExpExecArray | null;

  while ((match = WIKILINK_REGEX.exec(content)) !== null) {
    const entityType = (match[1] || "").toLowerCase();
    const title = match[2].trim();
    const displayText = match[3]?.trim() || null;

    matches.push({
      raw: match[0],
      entityType,
      title,
      displayText,
    });
  }

  return matches;
}

/**
 * Extract unique link targets from content.
 */
export function extractLinkTargets(content: string): { entityType: string; title: string }[] {
  const seen = new Set<string>();
  const targets: { entityType: string; title: string }[] = [];

  for (const match of parseWikilinks(content)) {
    const key = `${match.entityType}:${match.title}`;
    if (!seen.has(key)) {
      seen.add(key);
      targets.push({ entityType: match.entityType, title: match.title });
    }
  }

  return targets;
}

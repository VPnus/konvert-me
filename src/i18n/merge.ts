import type { Dictionary, Draft } from '@/i18n/types';

type Node = Readonly<Record<string, unknown>>;

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * A draft of a translation over the Russian dictionary: every word the draft has replaces the
 * Russian one, a list as a whole; what it does not have yet stays Russian.
 */
export function mergeDraft(base: Dictionary, draft: Draft): Dictionary {
  const merge = (from: Node, over: Node): Node => {
    const result: Record<string, unknown> = { ...from };
    for (const [key, value] of Object.entries(over)) {
      if (value === undefined) continue;
      result[key] = isNode(value) && isNode(from[key]) ? merge(from[key], value) : value;
    }
    return result;
  };
  return merge(base as Node, draft as Node) as Dictionary;
}

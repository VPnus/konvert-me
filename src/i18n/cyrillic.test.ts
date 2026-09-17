import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * A word of the interface outside the dictionary would stay Russian in any language. Only the
 * dictionary, the norms of the law (with their names and sources) and the headers a Russian bank
 * statement is recognised by may hold Russian letters in a string of the code.
 */
const ALLOWED = [/^i18n\/ru\.ts$/, /^core\/rules\//, /^lib\/statement\/table\.ts$/];

const SOURCE = join(process.cwd(), 'src');
const CYRILLIC = /[А-Яа-яЁё]/;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

function russianStrings(path: string): string[] {
  const code = readFileSync(path, 'utf8');
  const file = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    const isText =
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) ||
      ts.isJsxText(node);
    if (isText && CYRILLIC.test(node.text)) {
      const { line } = file.getLineAndCharacterOfPosition(node.getStart());
      found.push(`${line + 1}: ${node.text.trim().slice(0, 60)}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

describe('the words of the interface', () => {
  it('live in the dictionary: no Russian string elsewhere in the code', () => {
    const outside = sourceFiles(SOURCE)
      .map((path) => relative(SOURCE, path).split('\\').join('/'))
      .filter((path) => !ALLOWED.some((pattern) => pattern.test(path)))
      .flatMap((path) => russianStrings(join(SOURCE, path)).map((hit) => `${path}:${hit}`));

    expect(outside).toEqual([]);
    // It parses every file of the code: seconds with coverage, next to a busy suite.
  }, 60_000);
});

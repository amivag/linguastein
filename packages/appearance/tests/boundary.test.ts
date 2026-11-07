/**
 * The appearance core depends on nothing: every import is relative and stays inside
 * `src/`, and nothing is loaded at runtime. That is what lets any app use it, a
 * native one included, and what keeps it testable without a browser.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '..', 'src');

function sources(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    return entry.isDirectory() ? sources(path) : /\.tsx?$/.test(path) ? [path] : [];
  });
}

it.each(sources(ROOT))('%s imports only from inside the appearance core', (path) => {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  function visit(node: ts.Node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      const name = (node.moduleSpecifier as ts.StringLiteral).text;
      expect(name.startsWith('.'), `${path}: ${name}`).toBe(true);
      const target = relative(ROOT, resolve(dirname(path), name));
      expect(target.startsWith('..') || isAbsolute(target), `${path}: ${name}`).toBe(false);
    }
    // Runtime loading would bypass the static boundary above.
    if (ts.isCallExpression(node)) {
      expect(node.expression.kind, path).not.toBe(ts.SyntaxKind.ImportKeyword);
      expect(node.expression.getText(source), path).not.toBe('require');
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
});

/**
 * The kit depends only on itself, React and the navigation seam: no icon library,
 * no app module, and nothing loaded at runtime. That is what lets any app render
 * it, and what keeps a component from quietly needing one app's providers.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '..', 'src');
const ALLOWED = new Set(['react', 'react-dom', '@platform/navigation']);

function sources(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    return entry.isDirectory() ? sources(path) : /\.tsx?$/.test(path) ? [path] : [];
  });
}

it.each(sources(ROOT))('%s imports only the kit, React and navigation', (path) => {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  function visit(node: ts.Node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      const name = (node.moduleSpecifier as ts.StringLiteral).text;
      if (!ALLOWED.has(name)) {
        expect(name.startsWith('.'), `${path}: ${name}`).toBe(true);
        const target = relative(ROOT, resolve(dirname(path), name));
        expect(target.startsWith('..') || isAbsolute(target), `${path}: ${name}`).toBe(false);
      }
    }
    if (ts.isCallExpression(node)) {
      expect(node.expression.kind, path).not.toBe(ts.SyntaxKind.ImportKeyword);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
});

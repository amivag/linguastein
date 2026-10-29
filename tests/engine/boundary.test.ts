/** A copyable engine must have no hidden imports back into its host app. */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve, relative, isAbsolute } from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';

function sources(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    return entry.isDirectory() ? sources(path) : path.endsWith('.ts') ? [path] : [];
  });
}

it.each(['src/engine', 'src/appearance'])(
  'keeps every %s dependency inside its copyable directory',
  (directory) => {
    const root = resolve(directory);
    for (const path of sources(root)) {
      const source = ts.createSourceFile(
        path,
        readFileSync(path, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
      );
      function visit(node: ts.Node) {
        if (
          (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
          node.moduleSpecifier
        ) {
          expect(ts.isStringLiteral(node.moduleSpecifier)).toBe(true);
          const name = (node.moduleSpecifier as ts.StringLiteral).text;
          expect(name.startsWith('.'), `${path}: ${name}`).toBe(true);
          const target = relative(root, resolve(dirname(path), name));
          expect(target.startsWith('..') || isAbsolute(target), `${path}: ${name}`).toBe(false);
        }
        // Runtime loading would bypass the static dependency boundary above.
        if (ts.isCallExpression(node)) {
          expect(node.expression.kind, path).not.toBe(ts.SyntaxKind.ImportKeyword);
          expect(node.expression.getText(source), path).not.toBe('require');
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
  },
);

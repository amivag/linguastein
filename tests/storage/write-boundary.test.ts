/** New assessment screens must not reintroduce split evidence/progress writes. */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';
function sources(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    return entry.isDirectory() ? sources(path) : /\.tsx?$/.test(path) ? [path] : [];
  });
}
it('routes assessed evidence through the atomic storage operation', () => {
  const violations: string[] = [];
  for (const path of sources('src/features')) {
    const source = ts.createSourceFile(
      path,
      readFileSync(path, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    function visit(node: ts.Node) {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const method = node.expression.name.text;
        const receiver = node.expression.expression;
        if (
          ts.isPropertyAccessExpression(receiver) &&
          ((receiver.name.text === 'progress' && ['put', 'putMany'].includes(method)) ||
            (receiver.name.text === 'attempts' && ['append', 'appendMany'].includes(method)))
        ) {
          violations.push(`${path}: ${node.expression.getText(source)}`);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  expect(violations, 'Use saveAttempts so evidence and projection commit together').toEqual([]);
});

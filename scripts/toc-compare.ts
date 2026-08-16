import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { extractHeadings } from '../packages/template-astro/src/utils/chronicleMarkdown.ts';

const POSTS = join(process.cwd(), 'data', 'posts');
function stripFrontmatter(raw: string): string {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  return m ? raw.slice(m[0].length) : raw;
}

const results: string[] = [];
for (const dir of readdirSync(POSTS)) {
  const dirPath = join(POSTS, dir);
  if (!statSync(dirPath).isDirectory()) continue;
  const mdPath = join(dirPath, 'index.md');
  const raw = readFileSync(mdPath, 'utf-8');
  const content = stripFrontmatter(raw);
  const items = extractHeadings(content);
  results.push(dir + ': ' + items.length + ' headings; first=' + JSON.stringify(items[0]));
}
console.log(results.join('\n'));
console.log('=== extractHeadings OK on ' + results.length + ' posts ===');
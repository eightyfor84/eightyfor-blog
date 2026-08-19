/**
 * collections 插件 — 文件变化解释器
 *
 * 把 data/collections.yml 的变化理解为主页 activity 条目（与原生 app/post/delete
 * 并列，不单独成块）：
 *   - A（新增文件）→ "新增合集 <name>"（当前合集树前 N 个）
 *   - M（修改）    → "更新合集 <name>"
 * collections.yml 是整文件变化（非单合集文件），无法区分具体哪个合集新增——
 * 解释器读当前合集树，把变化信号映射为可见条目；数据自读 DataSource。
 */
import type { PluginChangeInterpreter, ChangedFile, ActivityItem, ChangeInterpreterCtx } from '../types';

const DISPLAY_LIMIT = 2;

function readCollections(dataSource: ChangeInterpreterCtx['dataSource']): any[] {
  try {
    const raw = (dataSource.getCollections?.() as any) || [];
    const arr = Array.isArray(raw) ? raw : (Array.isArray(raw?.collections) ? raw.collections : []);
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  } catch {
    return [];
  }
}

export const collectionsChangeInterpreter: PluginChangeInterpreter = {
  match: 'data/collections.yml',

  interpret(changes: ChangedFile[], ctx: ChangeInterpreterCtx): ActivityItem[] {
    const { dataSource, t = (k: string) => k } = ctx;
    const touched = changes.filter((c) => c.status === 'A' || c.status === 'M');
    if (!touched.length) return [];

    const label = touched.some((c) => c.status === 'A')
      ? t('home.newCollections')
      : t('home.newCollections'); // 修改也沿用"新增合集"标签（无"更新合集"文案）
    return readCollections(dataSource)
      .slice(0, DISPLAY_LIMIT)
      .map((col) => ({
        tone: 'collection',
        label,
        title: String(col?.name || '').trim() || 'Untitled',
      }));
  },
};

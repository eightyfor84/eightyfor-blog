/**
 * collections 插件 — 文件变化解释器
 *
 * 把 data/collections.yml 的变化理解为主页 activity 条目（与原生 app/post/delete
 * 并列，不单独成块）。
 *
 * 内容级 diff：collections.yml 是整文件变化（单文件），M 不代表合集一定变了——
 * 可能是改导航配置/调整顺序。解释器读聚合窗口起点（baseCommit）的旧版内容，
 * 与当前（HEAD）对比，**只有真正新增或修改的合集**才进入 activity：
 *   - 新增（旧版无此合集）   → "新增合集 <name>"（New collection）
 *   - 修改（内容变化）       → "更新合集 <name>"（Updated collection）
 *   - 未变/删除/仅配置变化   → 不报
 * 无 baseCommit（无窗口起点）时保守回退：A（文件整体新增）→ 当前合集全当新增；
 * M 无法对比 → 不报。
 */
import YAML from 'yaml';
import type { PluginChangeInterpreter, ChangedFile, ActivityItem, ChangeInterpreterCtx } from '../types';
import { buildLocalizedPath } from '../../utils/routeLocale';
import { getFileAtRevision } from '@chronicle/shared/src/utils/git';

const DISPLAY_LIMIT = 2;

/** 合集唯一键：name（页面锚点用 name，视为唯一） */
function collectionKey(col: any): string {
  return String(col?.name || '').trim();
}

/** 解析 collections.yml 文本 → 合集数组（兼容裸数组与 { collections: [...] }） */
function parseCollectionsYaml(text: string | null): any[] {
  if (!text) return [];
  try {
    const data = YAML.parse(text) || {};
    const arr = Array.isArray(data) ? data : data?.collections;
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  } catch {
    return [];
  }
}

/** 从 git 读取某版本的 collections.yml 并解析（读不到 → null） */
function readCollectionsAt(
  root: string | undefined,
  revision: string,
): any[] | null {
  if (!root) return null;
  const raw = getFileAtRevision(root, 'data/collections.yml', revision);
  if (raw === null) return null;
  return parseCollectionsYaml(raw);
}

export const collectionsChangeInterpreter: PluginChangeInterpreter = {
  match: 'data/collections.yml',

  interpret(changes: ChangedFile[], ctx: ChangeInterpreterCtx): ActivityItem[] {
    const { dataSource, t = (k: string) => k, locale = 'zh-CN', root, baseCommit } = ctx;
    const touched = changes.filter((c) => c.status === 'A' || c.status === 'M');
    if (!touched.length) return [];

    const collectionPath = buildLocalizedPath(locale, '/collection');
    const makeItem = (col: any, isNew: boolean): ActivityItem | null => {
      const name = collectionKey(col);
      if (!name) return null;
      return {
        tone: 'collection',
        label: isNew ? t('home.newCollection') : t('home.updatedCollection'),
        title: name,
        href: `${collectionPath}#${encodeURIComponent(name)}`,
      };
    };

    // ── 内容级 diff：旧版（窗口起点）vs 当前（HEAD），同源 git 解析 ──
    // git 不可读（root 为空/读失败）时回退 dataSource 当前合集（无对比 → A 全当新增）
    let current = readCollectionsAt(root, 'HEAD');
    if (current === null) {
      try {
        const raw = (dataSource.getCollections?.() as any) || [];
        current = Array.isArray(raw) ? raw : (Array.isArray(raw?.collections) ? raw.collections : []);
        current = Array.isArray(current) ? current.filter(Boolean) : [];
      } catch {
        current = [];
      }
    }
    const previous = baseCommit ? readCollectionsAt(root, baseCommit) : null;
    if (!current.length) return [];

    // 有对比依据：新增/修改才进 activity
    if (previous !== null) {
      const prevByName = new Map(previous.map((c) => [collectionKey(c), c]));
      const items: ActivityItem[] = [];
      for (const col of current) {
        const name = collectionKey(col);
        if (!name) continue;
        const prev = prevByName.get(name);
        if (!prev) {
          items.push(makeItem(col, true)); // 新增
        } else if (JSON.stringify(prev) !== JSON.stringify(col)) {
          items.push(makeItem(col, false)); // 修改
        }
      }
      return items.filter(Boolean).slice(0, DISPLAY_LIMIT) as ActivityItem[];
    }

    // ── 无对比依据（无 baseCommit）：保守回退 ──
    // 文件整体新增（A）→ 当前合集全当新增；M（无旧版可对比）→ 不报
    if (!touched.some((c) => c.status === 'A')) return [];
    return current.map((col) => makeItem(col, true)).filter(Boolean).slice(0, DISPLAY_LIMIT) as ActivityItem[];
  },
};

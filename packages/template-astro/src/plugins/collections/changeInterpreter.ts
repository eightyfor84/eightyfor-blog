/**
 * collections 插件 — 文件变化解释器
 *
 * 把 data/collections.yml 的变化理解为主页 activity 条目（与原生 app/post/delete
 * 并列，不单独成块）。
 *
 * 内容级 diff（消费 adapter 的 YAML-as-DataSource 通道）：
 * collections.yml 是整文件变化（单文件），M 不代表合集一定变了——可能是改导航
 * 配置/调整顺序/加注释。解释器用 ctx.yamlFileChanges（adapter 已把窗口起点旧版
 * 与当前 HEAD 都解析成 yaml 结构）对比，**只有真正新增或修改的合集**才进入 activity：
 *   - 新增（旧版无此合集）   → "新增合集 <name>"（New collection）
 *   - 修改（内容变化）       → "更新合集 <name>"（Updated collection）
 *   - 未变/删除/仅配置或顺序变化 → 不报
 * 无旧版可对比时保守回退：A（文件整体新增）→ 当前合集全当新增；M → 不报。
 */
import type { PluginChangeInterpreter, ChangedFile, ActivityItem, ChangeInterpreterCtx } from '../types';
import { buildLocalizedPath } from '../../utils/routeLocale';

const DISPLAY_LIMIT = 2;

/** 合集唯一键：name（页面锚点用 name，视为唯一） */
function collectionKey(col: any): string {
  return String(col?.name || '').trim();
}

/** 归一化合集列表：yaml 结构可能是裸数组或 { collections: [...] } 对象 */
function asCollectionList(value: unknown): any[] | null {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value && typeof value === 'object' && Array.isArray((value as any).collections)) {
    return (value as any).collections.filter(Boolean);
  }
  return null;
}

/** 回退读取 dataSource 当前合集（git 不可读/adapter 未提供时） */
function currentFromDataSource(dataSource: ChangeInterpreterCtx['dataSource']): any[] {
  try {
    const raw = (dataSource.getCollections?.() as any) || [];
    return asCollectionList(raw) ?? [];
  } catch {
    return [];
  }
}

export const collectionsChangeInterpreter: PluginChangeInterpreter = {
  match: 'data/collections.yml',

  interpret(changes: ChangedFile[], ctx: ChangeInterpreterCtx): ActivityItem[] {
    const { dataSource, t = (k: string) => k, locale = 'zh-CN', yamlFileChanges = [] } = ctx;
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

    // ── YAML-as-DataSource 通道：adapter 已解析旧版（previous）与当前（current）──
    const change = yamlFileChanges.find((c) => c.path === 'data/collections.yml');
    const current = asCollectionList(change?.current) ?? currentFromDataSource(dataSource);
    const previous = asCollectionList(change?.previous);
    if (!current.length) return [];

    // 有旧版可对比：新增/修改才进 activity（未变/删除/仅配置变化不报）
    if (previous !== null) {
      const prevByName = new Map(previous.map((c) => [collectionKey(c), c]));
      const items: ActivityItem[] = [];
      for (const col of current) {
        const name = collectionKey(col);
        if (!name) continue;
        const prev = prevByName.get(name);
        let item: ActivityItem | null = null;
        if (!prev) {
          item = makeItem(col, true); // 新增
        } else if (JSON.stringify(prev) !== JSON.stringify(col)) {
          item = makeItem(col, false); // 修改
        }
        if (item) items.push(item);
      }
      return items.slice(0, DISPLAY_LIMIT);
    }

    // ── 无旧版（无 baseCommit/adapter 未提供）：保守回退 ──
    // 文件整体新增（A）→ 当前合集全当新增；M（无旧版可对比）→ 不报
    if (!touched.some((c) => c.status === 'A')) return [];
    const fallbackItems: ActivityItem[] = [];
    for (const col of current) {
      const item = makeItem(col, true);
      if (item) fallbackItems.push(item);
    }
    return fallbackItems.slice(0, DISPLAY_LIMIT);
  },
};

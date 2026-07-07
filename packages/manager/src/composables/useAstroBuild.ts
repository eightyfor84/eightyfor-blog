/**
 * Chronicle Manager — Astro Build Trigger
 *
 * Triggers an Astro SSG build via the Electron IPC bridge.
 * The main process runs `npx astro build` in the template-astro directory.
 *
 * No HTTP, no auth — just IPC.
 */

import { getNotificationCenter } from './useNotificationCenter'

export interface BuildOptions {
  /** Human-readable trigger source, e.g. "Publish · Post Title" */
  source: string
  /** Optional post ID that triggered the build */
  postId?: string
  /** i18n translator function */
  t: (key: string) => string
  /** Optional key for sidebar-triggered builds */
  reason?: string
}

function isElectron(): boolean {
  return !!(typeof window !== 'undefined' && (window as any).chronicleElectron?.isElectron)
}

function getBridge(): any {
  return (window as any).chronicleElectron
}

export async function triggerBuild(opts: BuildOptions): Promise<void> {
  const nc = getNotificationCenter()
  const { t } = opts

  const detailLabels = {
    id: t('notification.detailId'),
    trigger: t('notification.detailTrigger'),
    time: t('notification.detailTime'),
  }

  const bt = nc.startBuild(`${t('settings.building')} · ${opts.source}`)
  if (!bt) return
  const { nid, clientBuildId } = bt
  nc.update(nid, { message: nc.buildDetail(detailLabels, clientBuildId, opts.source) })

  if (!isElectron()) {
    nc.update(nid, {
      state: 'failed',
      level: 'error',
      title: t('settings.buildFailed'),
      message: 'Build requires Electron runtime.',
    })
    throw new Error('Build requires Electron runtime.')
  }

  try {
    const bridge = getBridge()
    const result = await bridge.triggerBuild({
      codeDir: undefined, // main process uses default
      granularity: 'full',
      postId: opts.postId,
      reason: opts.reason || 'publish',
    })

    const baseMsg = nc.buildDetail(detailLabels, clientBuildId, opts.source)

    if (!result.success) {
      throw new Error(result.error || 'Build failed')
    }

    nc.update(nid, {
      state: 'completed',
      level: 'success',
      title: t('settings.buildCompleted'),
      message: baseMsg,
    })
  } catch (e: any) {
    nc.update(nid, {
      state: 'failed',
      level: 'error',
      title: t('settings.buildFailed'),
      message: `${nc.buildDetail(detailLabels, clientBuildId, opts.source)}\n${t('notification.detailError')}: ${e?.message || ''}`,
      actions: [{ label: t('nav.buildNow'), handler: 'retry-build' }],
    })
    throw e
  }
}

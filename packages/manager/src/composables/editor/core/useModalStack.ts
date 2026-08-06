import { ref, markRaw, type Component } from 'vue'

type Resolve<T> = (value: T | null) => void

interface ModalEntry {
  name: string
  component: Component
  props: Record<string, any>
  resolve: Resolve<any>
}

const registry = new Map<string, Component>()

export function registerModal(name: string, component: Component) {
  registry.set(name, component)
}

const modalStack = ref<ModalEntry[]>([])

export function useModal() {
  function openModal<T = any>(name: string, props?: Record<string, any>): Promise<T | null> {
    const component = registry.get(name)
    if (!component) {
      console.warn(`[useModal] No modal registered for "${name}"`)
      return Promise.resolve(null)
    }
    return new Promise((resolve) => {
      modalStack.value.push({
        name,
        component: markRaw(component),
        props: props || {},
        resolve,
      })
    })
  }

  function closeModal(result?: any) {
    const top = modalStack.value.pop()
    if (top) {
      top.resolve(result ?? null)
    }
  }

  function closeAll() {
    while (modalStack.value.length > 0) {
      modalStack.value.pop()?.resolve(null)
    }
  }

  return { openModal, closeModal, closeAll, modalStack }
}

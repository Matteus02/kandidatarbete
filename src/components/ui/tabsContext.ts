import type { InjectionKey, Ref } from 'vue'

export interface TabItem {
  id: string
  label: string
}

// Shared injection key so BaseTabs can provide and BaseTabPanel can inject
// the active tab id without a circular import.
export const ActiveTabKey: InjectionKey<Ref<string>> = Symbol('ActiveTab')

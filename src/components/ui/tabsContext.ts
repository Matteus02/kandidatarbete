import type { InjectionKey, Ref } from 'vue'

export interface TabItem {
  id: string
  label: string
}
export const ActiveTabKey: InjectionKey<Ref<string>> = Symbol('ActiveTab')

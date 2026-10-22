import type { EsteiraApi } from './index'

declare global {
  interface Window {
    esteira: EsteiraApi
  }
}

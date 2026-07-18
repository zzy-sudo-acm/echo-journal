import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'

// Mock crypto.randomUUID
if (!globalThis.crypto || !globalThis.crypto.randomUUID) {
  const mockCrypto = {
    randomUUID: () =>
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        const v = c === 'x' ? r : (r & 0x3) | 0x8
        return v.toString(16)
      }),
  }
  Object.defineProperty(globalThis, 'crypto', {
    value: { ...globalThis.crypto, ...mockCrypto },
    writable: true,
    configurable: true,
  })
}

// Mock URL.createObjectURL and revokeObjectURL for tests
if (!URL.createObjectURL || !URL.revokeObjectURL) {
  Object.defineProperty(URL, 'createObjectURL', {
    value: () => 'blob:test',
    writable: true,
    configurable: true,
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: () => {},
    writable: true,
    configurable: true,
  })
}

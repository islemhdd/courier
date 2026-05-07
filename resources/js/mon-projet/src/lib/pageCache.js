const CACHE_PREFIX = 'courier-page-cache:'
const DEFAULT_TTL_MS = 5 * 60 * 1000
const memoryCache = new Map()

function normalizeValue(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeValue)
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = normalizeValue(value[key])
        return result
      }, {})
  }

  return value
}

function getStorageKey(key) {
  return `${CACHE_PREFIX}${key}`
}

function isExpired(entry) {
  return !entry || typeof entry.expiresAt !== 'number' || entry.expiresAt <= Date.now()
}

function removeEntry(key) {
  memoryCache.delete(key)

  try {
    sessionStorage.removeItem(getStorageKey(key))
  } catch {}
  try {
    localStorage.removeItem(getStorageKey(key))
  } catch {}
}

function readStorageEntry(key, storage) {
  try {
    const raw = storage.getItem(getStorageKey(key))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeStorageEntry(key, entry, storage) {
  try {
    storage.setItem(getStorageKey(key), JSON.stringify(entry))
  } catch {}
}

export function buildPageCacheKey(page, params = {}) {
  return `${page}:${JSON.stringify(normalizeValue(params))}`
}

export function getPageCache(key) {
  const inMemory = memoryCache.get(key)

  if (inMemory && !isExpired(inMemory)) {
    return inMemory.value
  }

  let fromSession = readStorageEntry(key, sessionStorage)

  if (!fromSession || isExpired(fromSession)) {
    fromSession = readStorageEntry(key, localStorage)
  }

  if (!fromSession || isExpired(fromSession)) {
    removeEntry(key)
    return null
  }

  memoryCache.set(key, fromSession)
  return fromSession.value
}

export function setPageCache(key, value, ttlMs = DEFAULT_TTL_MS) {
  const entry = {
    value,
    expiresAt: Date.now() + ttlMs,
  }

  memoryCache.set(key, entry)

  writeStorageEntry(key, entry, sessionStorage)
  writeStorageEntry(key, entry, localStorage)
}

export function invalidatePageCache(keys) {
  const targets = Array.isArray(keys) ? keys : [keys]

  for (const target of targets) {
    const memoryKeys = Array.from(memoryCache.keys())

    for (const key of memoryKeys) {
      if (key === target || key.startsWith(`${target}:`)) {
        removeEntry(key)
      }
    }

    const removeFromStorage = (storage) => {
      try {
        const storageKeys = []
        for (let index = 0; index < storage.length; index += 1) {
          const storageKey = storage.key(index)
          if (storageKey?.startsWith(getStorageKey(target))) {
            storageKeys.push(storageKey)
          }
        }
        for (const storageKey of storageKeys) {
          storage.removeItem(storageKey)
        }
      } catch {}
    }

    removeFromStorage(sessionStorage)
    removeFromStorage(localStorage)
  }
}

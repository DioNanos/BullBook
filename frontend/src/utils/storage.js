export function safeGet(key, fallback = null) {
  try {
    const v = window.localStorage.getItem(key)
    return v === null ? fallback : v
  } catch (_) {
    return fallback
  }
}

export function safeSet(key, value) {
  try {
    window.localStorage.setItem(key, value)
    return true
  } catch (_) {
    return false
  }
}

export function safeRemove(key) {
  try {
    window.localStorage.removeItem(key)
    return true
  } catch (_) {
    return false
  }
}

export function safeGetJSON(key, fallback = null) {
  const raw = safeGet(key, null)
  if (raw == null) return fallback
  try {
    return JSON.parse(raw)
  } catch (_) {
    return fallback
  }
}

export function safeSetJSON(key, value) {
  try {
    return safeSet(key, JSON.stringify(value))
  } catch (_) {
    return false
  }
}


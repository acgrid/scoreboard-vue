export const ROOT = 'root'
export const GUEST = 'guest'
export const isRoot = name => name === ROOT
export const isGuest = name => name === GUEST
export const isJudge = name => name && !isRoot(name) && !isGuest(name)

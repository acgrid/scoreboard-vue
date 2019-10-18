export const ROOT = 'root'
export const ASSISTANT = 'zl'
export const GUEST = 'guest'
export const isRoot = name => name === ROOT
export const isGuest = name => name === GUEST
export const isAssistant = name => name === ASSISTANT
export const isJudge = name => name && !isRoot(name) && !isGuest(name)
export const canDetermine = name => isRoot(name) || isAssistant(name)

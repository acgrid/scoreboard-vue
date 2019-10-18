export const ROOT = 'root'
export const ASSISTANT = 'assist'
export const GUEST = 'guest'
export const isRoot = name => name === ROOT
export const isGuest = name => name === GUEST
export const isAssistant = name => name === ASSISTANT
export const isJudge = name => name && !isRoot(name) && !isGuest(name) && !isAssistant(name)
export const canAdjust = name => isRoot(name) || isAssistant(name)
export const canDetermine = name => isRoot(name) || isAssistant(name)

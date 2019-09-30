import config from 'config'
export const isDev = !config.get('production')
export const isProd = !isDev

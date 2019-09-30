import { EventEmitter } from 'events'
import express from 'express'
import jsonErrorHandler from 'express-json-error-handler/lib'
import 'express-async-errors'
import http from 'http'
import debug from 'debug'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import boom from '@hapi/boom'
import routes from './routes'
import './mongoose'
import socket from './socket'

EventEmitter.defaultMaxListeners = 25
const dbg = debug('sc:main')
const api = express()

api.set('x-powered-by', false)

api.use(jsonErrorHandler(({ err, req }) => {
  console.error(err, req)
}))
api.use((err, req, res, next) => {
  if (err.name === 'MongoError') {
    switch (err.code) {
      case 11000: next(boom.conflict('冲突：已经存在')); break
      default: next(boom.badRequest(err.message))
    }
  } else {
    next(err)
  }
})

api.use(cors())
api.use(express.json({ strict: false }))
api.use(cookieParser())
api.use(routes)

api.use((err, req, res, next) => {
  next(err instanceof SyntaxError && err.status === 400 && 'body' in err ? boom.badRequest(`JSON decode error: ${err.message}`) : err)
})

api.use((err, req, res, next) => {
  if (err.isBoom) {
    if (!res.headersSent) res.status(err.output.statusCode)
    if (err.data) err.output.payload.extra = err.data
    res.json(err.output.payload)
  } else {
    next(err)
  }
})

if (process.env.NODE_ENV === 'production') {
  api.use((err, req, res, next) => {
    if (!res.headersSent) res.status(500)
    res.json(err)
  })
}

const server = http.createServer(api)

function formatBind (server) {
  const addr = server.address()
  return typeof addr === 'string' ? `pipe ${addr}` : `port ${addr.port}`
}

server.on('error', error => {
  dbg('server bind error', error)
  if (error.syscall !== 'listen') {
    throw error
  }

  const bind = formatBind(server)

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges')
      process.exit(1)
    case 'EADDRINUSE':
      console.error(bind + ' is already in use')
      process.exit(1)
    default:
      throw error
  }
})
server.on('listening', () => {
  dbg(`API service started on ${formatBind(server)}`)
})

socket(server)

server.listen((val => {
  const port = parseInt(val, 10)

  if (isNaN(port)) {
    // named pipe
    return val
  }

  if (port >= 0) {
    // port number
    return port
  }

  return false
})(process.env.PORT || '3003'))

if (module.hot) {
  module.hot.accept()
  module.hot.dispose(() => server.close())
}

export default server

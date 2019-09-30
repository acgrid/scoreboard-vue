import config from 'config'
import mongoose from 'mongoose'
import debug from 'debug'
import chalk from 'chalk'

const dbg = debug('sc:mongoose')

mongoose.connect(config.get('mongo.dsn'), { useUnifiedTopology: true, useNewUrlParser: true, useFindAndModify: false, useCreateIndex: true, ...config.get('mongo.options') })

mongoose.connection.on('connected', () => {
  dbg('connected to mongodb')
})

mongoose.connection.on('error', err => {
  dbg('mongodb error', err)
  chalk.bgRed.bold.whiteBright('STOP: MONGODB CONNECTION FAILED')
})

export function setDocument (doc, updates) {
  Object.keys(updates).forEach(key => {
    doc[key] = doc[key] === null ? undefined : updates[key]
  })
  return doc
}

export function makeSetUnset (updates) {
  const $set = {}
  const $unset = {}
  Object.keys(updates).forEach(key => {
    updates[key] === null ? $unset[key] = '' : $set[key] = updates[key]
  })
  return { $set, $unset }
}

export default mongoose

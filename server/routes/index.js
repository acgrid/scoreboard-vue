import os from 'os'
import express from 'express'
import boom from '@hapi/boom'
import omit from 'loadsh/omit'
import { isProd } from './env'
import Judge from '../model/judge'
import Evaluation from '../model/evaluation'
import Discipline from '../model/discipline'
import Candidate from '../model/candidate'
import Contest from '../model/contest'

const router = express.Router()

router.get('/', (_, res) => {
  res.json({
    server: os.hostname(),
    production: isProd
  })
})

const MODELS = {
  judge: Judge,
  evaluation: Evaluation,
  discipline: Discipline,
  candidate: Candidate,
  contest: Contest
}

router.post('/data/:model', async (req, res, next) => {
  const Model = MODELS[req.params.model]
  if (!Model) return next(boom.badData('Model is not allowed'))
  const upsert = async doc => {
    const m = await Model.findById(doc._id)
    return m ? m.set(omit(doc, '_id')).save() : Model.create(doc)
  }
  try {
    if (Array.isArray(req.body)) {
      res.json(await Promise.all(req.body.map(upsert)))
    } else {
      res.json(await upsert(req.body))
    }
  } catch (e) {
    next(e)
  }
})

router.delete('/data/:model', async (req, res, next) => {
  const Model = MODELS[req.params.model]
  if (!Model) return next(boom.badData('Model is not allowed'))
  try {
    if (Array.isArray(req.body)) {
      await Promise.all(req.body.map(m => (new Model(m)).remove()))
    } else {
      await (new Model(req.body)).remove()
    }
    res.status(204)
  } catch (e) {
    next(e)
  }
})

export default router

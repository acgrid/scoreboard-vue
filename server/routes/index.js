import os from 'os'
import express from 'express'
import boom from '@hapi/boom'
import { isProd } from './env'
import Judge from '../model/judge'
import Evaluation from '../model/evaluation'
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
  candidate: Candidate,
  contest: Contest
}

router.post('/data/:model', async (req, res, next) => {
  const Model = MODELS[req.params.model]
  if (!Model) return next(boom.badData('Model is not allowed'))
  try {
    if (Array.isArray(req.body)) {
      const models = []
      for (let m of req.body) {
        const model = new Model(m)
        models.push(await model.save())
      }
      res.json(models)
    } else {
      const model = new Model(req.body)
      await model.save()
      res.json(model)
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

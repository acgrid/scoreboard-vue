import io from 'socket.io'
import debug from 'debug'

import { isJudge } from '../lib/identity'
import Judge from './model/judge'
import Contest from './model/contest'
import Score from './model/score'

const dbg = debug('sc:socket')

export default function (http) {
  const server = io(http)
  server.on('connection', function (socket) {
    dbg('connection', socket.id)
    const session = { contest: null, judge: null }
    socket.on('auth', async (contest, judge, password, ack) => {
      dbg(`Auth: ${contest}: ${judge} with password ${password}`)
      const resp = {}
      resp.contest = await Contest.findById(contest).populate('judges', '-password').populate('evaluations.items').populate('groups.candidates')
      if (!resp.contest) return ack({ error: '赛事不存在' })
      if (!resp.contest.judges.find(j => j._id === judge)) return ack({ error: '不是本赛事评委' })
      resp.judge = await Judge.findOne({ _id: judge, password }, '-password')
      if (!resp.judge) return ack({ error: '评委密码错误' })
      socket.join(contest, async error => {
        if (error) return ack({ error })
        session.judge = judge
        session.contest = contest
        resp.scores = await Score.find({ contest }, 'judge evaluation candidate score modified')
        ack(resp)
      })
    })
    socket.on('score', async (evaluation, candidate, score, ack) => {
      if (session.contest && isJudge(session.judge)) {
        dbg(`Score: ${session.contest}: ${session.judge} : ${candidate} : ${evaluation} : ${score}`)
        if (!evaluation || !candidate || Number.isNaN(score)) return
        let s
        const primary = { ...session, evaluation, candidate }
        const pervious = await Score.findOne(primary)
        try {
          if (pervious) {
            s = pervious
            s.modified.push(s.score)
            s.score = score
            await s.save()
          } else {
            s = await Score.create({ ...primary, score })
          }
          socket.to(session.contest).emit('score', s)
          ack({ s })
        } catch (e) {
          dbg('Error', e)
          ack({ e })
        }
      }
    })
  })
  return server
}

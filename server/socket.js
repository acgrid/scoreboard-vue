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
    const session = { contest: null, judge: null }
    socket.on('auth', async (transport, ack) => {
      const { judge, password, contest } = transport
      const contestData = await Contest.findById(contest).populate('judges')
      if (!contestData) return ack({ error: '赛事不存在' })
      if (!contestData.judges.find(j => j._id === judge)) return ack({ error: '不是本赛事评委' })
      if (!await Judge.exists({ _id: judge, password })) return ack({ error: '评委密码错误' })
      session.judge = judge
      session.contest = contest
      socket.join(contest, async error => {
        if (error) return ack({ error })
        contestData.scores = await Score.find({ contest }, 'judge evaluate candidate score modified')
        ack(contestData)
      })
    })
    socket.on('score', async (transport, ack) => {
      if (session.contest && isJudge(session.judge)) {
        let s
        const { evaluate, candidate, score } = transport
        if (!evaluate || !candidate) return ack({ error: 'Missing' })
        const primary = { ...session, evaluate, candidate }
        const pervious = await Score.findOne(primary)
        if (pervious) {
          s = pervious
          s.modified.push(s.score)
          s.score = score
          await s.save()
        } else {
          s = await Score.create({ ...primary, score })
        }
        socket.to(session.contest).emit('score', s)
        ack(s)
      }
    })
  })
  return server
}

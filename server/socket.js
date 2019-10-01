import io from 'socket.io'
import debug from 'debug'
import range from 'loadsh/range'
import { isRoot, isJudge } from '../lib/identity'
import Judge from './model/judge'
import Contest from './model/contest'
import Score from './model/score'

const dbg = debug('sc:socket')

const makeContest = async c => Contest.findById(c).populate('judges', '-password').populate('evaluations.items').populate('groups.candidates')

export default function (http) {
  const server = io(http)
  server.on('connection', function (socket) {
    dbg('connection', socket.id)
    const session = { contest: null, judge: null }
    socket.on('auth', async (contest, judge, password, ack) => {
      dbg(`Auth: ${contest}: ${judge} with password ${password}`)
      const resp = {}
      resp.contest = await makeContest(contest)
      if (!resp.contest) return ack({ error: '赛事不存在' })
      if (isJudge(judge) && !resp.contest.judges.find(j => j._id === judge)) return ack({ error: '不是本赛事评委' })
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
    socket.on('reset', async ack => {
      if (session.contest && isRoot(session.judge)) {
        try {
          await Score.remove({ contest: session.contest })
          ack()
        } catch (e) {
          ack(e)
        }
      }
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
    socket.on('eliminate', async (round, candidate, ack) => {
      dbg(`Eliminate: ${round}: ${candidate}`)
      if (round > 0 && session.contest && isRoot(session.judge)) {
        const contest = await Contest.findById(session.contest)
        if (!contest.round) return
        if (round >= contest.groups.length) return
        range(round, contest.groups.length).forEach(index => {
          const group = contest.groups[index]
          if (!group) return
          const found = group.candidates.indexOf(candidate)
          if (!group.eliminated) group.eliminated = []
          if (found >= 0) group.eliminated.push(group.candidates.splice(found, 1))
        })
        console.log(contest)
        await contest.save()
        const c = await makeContest(session.contest)
        socket.to(session.contest).emit('contest', c)
        ack(c)
      }
    })
  })
  return server
}

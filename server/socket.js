import io from 'socket.io'
import debug from 'debug'
import { isRoot, isJudge, canDetermine } from '../lib/identity'
import Judge from './model/judge'
import Candidate from './model/candidate'
import Contest from './model/contest'
import Score from './model/score'
import Adjust from './model/adjust'

const dbg = debug('sc:socket')

const makeContest = async c => Contest.findById(c).populate('judges', '-password').populate('evaluations.items').populate('disciplines').populate((await Contest.findById(c, 'candidates')).candidates.map((_, index) => `candidates.${index}`).join(' '))
const ensureCandidate = (id, groups) => groups.findIndex(group => group.findIndex(candidate => candidate && candidate.equals ? candidate.equals(id) : candidate === id) !== -1) !== -1

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
        resp.adjusts = await Adjust.find({ contest }, 'discipline candidate value')
        ack(resp)
      })
    })
    socket.on('populate', async (groups, ack) => {
      console.log(session, groups)
      if (session.contest && isRoot(session.judge)) {
        try {
          await Score.deleteMany({ contest: session.contest })
          const contest = await Contest.findById(session.contest)
          contest.promotions = []
          contest.eliminations = []
          if (groups) { // populate
            if (contest.candidates && contest.candidates.length) {
              await Promise.all(contest.candidates.map(async groups => Candidate.deleteMany({ _id: { $in: groups } })))
            }
            contest.candidates = await Promise.all(groups.map(async group => {
              return Promise.all(group.map(async candidate => {
                return (await Candidate.create(candidate))._id
              }))
            }))
            console.log(contest.candidates)
          }
          await contest.save()
          const c = await makeContest(session.contest)
          socket.to(session.contest).emit('contest', c)
          ack({ c })
        } catch (e) {
          console.error(e)
          ack({ e })
        }
      }
    })
    socket.on('scores', async (ack) => {
      ack(await Score.find({ contest: session.contest }, 'judge evaluation candidate score modified'))
    })
    socket.on('score', async (evaluation, candidate, score, judge, ack) => {
      if (!isRoot(session.judge)) judge = session.judge
      if (session.contest && isJudge(judge)) {
        dbg(`Score: ${session.contest}: ${judge} : ${candidate} : ${evaluation} : ${score}`)
        if (!evaluation || !candidate || Number.isNaN(score)) return
        let s
        const primary = { contest: session.contest, judge, evaluation, candidate }
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
    socket.on('determine', async (determination, phase, candidate, ack) => {
      if (session.contest && canDetermine(session.judge)) {
        if (Number.isNaN(phase) || phase < 0) return dbg('Bad group datatype')
        dbg(`${determination ? 'Promoted' : 'Eliminated'} : ${phase}: ${candidate}`)
        const contest = await Contest.findById(session.contest)
        if (phase >= contest.evaluations.length) return dbg('Group index overflow')
        if (!ensureCandidate(candidate, contest.candidates)) return dbg('Candidate does not exist')
        if (ensureCandidate(candidate, contest.promotions)) return dbg('Candidate already promoted')
        if (ensureCandidate(candidate, contest.eliminations)) return dbg('Candidate already eliminated')
        contest[determination ? 'promotions' : 'eliminations'].push(candidate)
        await contest.save()
        const c = await makeContest(session.contest)
        socket.to(session.contest).emit('contest', c)
        ack(c)
      }
    })
    socket.on('adjust', async (discipline, candidate, value, ack) => {
      if (session.contest && canDetermine(session.judge)) {
        const primary = { contest: session.contest, candidate, discipline }
        try {
          let a = await Adjust.findOne(primary)
          if (a) {
            a.value = value
            await a.save()
          } else {
            a = await Adjust.create({ ...primary, value })
          }
          socket.to(session.contest).emit('adjust', a)
          ack({ a })
        } catch (e) {
          dbg('Error', e)
          ack({ e })
        }
      }
    })
  })
  return server
}

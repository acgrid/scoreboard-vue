import mongoose, { Schema } from 'mongoose'
import { Adjust, Contest as ContestRef, Candidate as CandidateRef, Discipline as DisciplineRef } from './index'
import Contest from './contest'
import Discipline from './discipline'
import fk from './traits/foreign-key'

export const schema = new Schema({
  contest: { type: String, ref: ContestRef, required: true },
  candidate: { type: mongoose.Types.ObjectId, ref: CandidateRef, required: true },
  discipline: { type: String, ref: DisciplineRef, required: true },
  value: { type: Number, required: true }
}, { timestamps: true })

schema.index({ contest: 1, candidate: 1, discipline: 1 }, { unique: true })

schema.pre('save', async function () {
  await fk(Contest, this.contest)
  await fk(Discipline, this.discipline)
  const contest = await Contest.findById(this.contest)
  if (!contest) throw new Error('赛事不存在')
  if (!contest.candidates.reduce((candidates, group) => {
    candidates.push(...group)
    return candidates
  }, []).find(c => c.equals(this.candidate))) throw new Error('非参赛选手')
  if (this.group >= contest.evaluations.length) throw new Error('轮次调整错误')
})

export default mongoose.model(Adjust, schema)

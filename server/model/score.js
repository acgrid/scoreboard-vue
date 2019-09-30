import mongoose, { Schema } from 'mongoose'
import { Score, Contest as ContestRef, Judge as JudgeRef, Candidate as CandidateRef, Evaluation as EvaluationRef } from './index'
import Contest from './contest'
import fk from './traits/foreign-key'

export const schema = new Schema({
  contest: { type: String, ref: ContestRef, required: true },
  judge: { type: String, ref: JudgeRef, required: true },
  candidate: { type: String, ref: CandidateRef, required: true },
  evaluation: { type: String, ref: EvaluationRef, required: true },
  score: { type: Number, required: true },
  modified: { type: [Number], default: [] }
}, { timestamps: true })

schema.index({ contest: 1, judge: 1, candidate: 1, evaluation: 1 }, { unique: true })

schema.pre('save', async function () {
  await fk(Contest, this.contest)
  const contest = await Contest.findById(this.contest)
  if (!contest) throw new Error('赛事不存在')
  console.log(contest.groups)
  if (contest.judges.indexOf(this.judge) === -1) throw new Error('非赛事评委')
  if (contest.groups.reduce((candidates, group) => {
    candidates.push(...group.candidates)
    return candidates
  }, []).indexOf(this.candidate) === -1) throw new Error('非参赛选手')
  if (contest.evaluations.reduce((evaluations, group) => {
    evaluations.push(...group.items)
    return evaluations
  }, []).indexOf(this.evaluation) === -1) throw new Error('非评分项目')
})

export default mongoose.model(Score, schema)

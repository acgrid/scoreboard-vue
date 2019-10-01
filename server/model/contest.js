import mongoose, { Schema } from 'mongoose'
import uniq from 'loadsh/uniq'
import { Contest, Judge as JudgeRef } from './index'
import Evaluation from './evaluation'
import EvaluationGroup from './evaluation-group'
import Candidate from './candidate'
import CandidateGroup from './candidate-group'
import Judge from './judge'
import fk from './traits/foreign-key'

export const schema = new Schema({
  _id: { type: String, required: true, maxlength: 64, trim: true },
  name: { type: String, required: true, maxlength: 120, trim: true },
  date: { type: Date, required: true },
  rules: { type: [String] },
  judges: { type: [{ type: String, ref: JudgeRef }], required: true, set: judges => uniq(judges.filter(judge => !!judge)), validate: j => j.length > 0 },
  evaluations: { type: [EvaluationGroup], required: true, validate: ge => ge.length > 0 },
  groups: { type: [CandidateGroup], required: true, validate: gc => gc.length > 0 },
  round: { type: Boolean, default: false } // Round mode means evaluations are divided to groups above
}, { _id: false, autoCreate: true })

schema.pre('save', async function () {
  await Promise.all(this.judges.map(async judge => fk(Judge, judge)))
  await Promise.all(this.evaluations.map(async group => Promise.all(group.items.map(async e => fk(Evaluation, e)))))
  await Promise.all(this.groups.map(async group => Promise.all(group.candidates.map(async c => fk(Candidate, c)))))
})

export default mongoose.model(Contest, schema)

import mongoose, { Schema } from 'mongoose'
import uniq from 'loadsh/uniq'
import { Contest, Judge as JudgeRef, Discipline as DisciplineRef, Candidate as CandidateRef } from './index'
import Evaluation from './evaluation'
import EvaluationGroup from './evaluation-group'
import Candidate from './candidate'
import Judge from './judge'
import fk from './traits/foreign-key'

const CandidateId = { type: mongoose.Types.ObjectId, ref: CandidateRef }

export const schema = new Schema({
  _id: { type: String, required: true, maxlength: 64, trim: true },
  name: { type: String, required: true, maxlength: 120, trim: true },
  date: { type: Date, required: true },
  rules: { type: [String] },
  judges: { type: [{ type: String, ref: JudgeRef }], required: true, set: judges => uniq(judges.filter(judge => !!judge)), validate: j => j.length > 0 },
  disciplines: { type: [{ type: String, ref: DisciplineRef }], default: [], set: disciplines => uniq(disciplines.filter(discipline => !!discipline)) },
  evaluations: { type: [EvaluationGroup], required: true, validate: g => g.length > 0 },
  candidates: { type: [[CandidateId]], default: [], validate: groups => groups.reduce((prev, group) => prev && group.length > 0, true) },
  promotions: { type: [[CandidateId]], default: [] }, // Do not confuse its index, index of candidates is used for grouping, promotions/eliminations is used for evaluation groups
  eliminations: { type: [[CandidateId]], default: [] },
  multiplier: { type: Number, default: 10 },
  highest: { type: Number, default: 1 },
  lowest: { type: Number, default: 1 },
  borders: { type: [Number], default: [] } // Rank border lines
}, { _id: false, autoCreate: true })

const ensureCandidates = groups => Array.isArray(groups) && Promise.all(groups.map(async group => Promise.all(group.map(async candidate => fk(Candidate, candidate)))))

schema.pre('save', async function () {
  await Promise.all(this.judges.map(async judge => fk(Judge, judge)))
  await Promise.all(this.evaluations.map(async group => Promise.all(group.items.map(async e => fk(Evaluation, e)))))
  await ensureCandidates(this.candidates)
  await ensureCandidates(this.promotions)
  await ensureCandidates(this.eliminations)
})

export default mongoose.model(Contest, schema)

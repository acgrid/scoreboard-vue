import mongoose, { Schema } from 'mongoose'
import { Score, Contest as ContestRef, Judge as JudgeRef, Candidate as CandidateRef, Evaluation as EvaluationRef } from './index'
import { pack } from '../../lib/score'

export const schema = new Schema({
  contest: { type: Schema.Types.ObjectId, ref: ContestRef, required: true },
  judge: { type: Schema.Types.ObjectId, ref: JudgeRef, required: true },
  candidate: { type: Schema.Types.ObjectId, ref: CandidateRef, required: true },
  evaluation: { type: Schema.Types.ObjectId, ref: EvaluationRef, required: true },
  score: { type: Number, required: true },
  modified: { type: [Number], default: [] }
}, { timestamps: true, toObject: { virtuals: true } })

schema.virtual('path').get(pack)

schema.index({ contest: 1, judge: 1, candidate: 1, evaluation: 1 }, { unique: true })

export default mongoose.model(Score, schema)

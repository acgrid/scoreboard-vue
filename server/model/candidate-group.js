import { Schema } from 'mongoose'
import { Candidate as CandidateRef } from './index'

export default new Schema({
  name: { type: String, required: true, trim: true },
  candidates: { type: [{ type: String, ref: CandidateRef }], required: true, validate: candidates => candidates.length > 0 },
  eliminated: { type: [{ type: String, ref: CandidateRef }], default: [] },
  chunk: { type: Number, min: 0, default: 0 },
  head: { type: Number, min: 0, default: 1 },
  tail: { type: Number, min: 0, default: 1 }
})

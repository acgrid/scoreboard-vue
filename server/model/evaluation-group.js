import { Schema } from 'mongoose'
import { Evaluation as EvaluationRef } from './index'

export default new Schema({
  name: { type: String, required: true, trim: true },
  items: { type: [{ type: String, ref: EvaluationRef }], required: true, validate: items => items.length > 0 },
  eliminated: { type: [{ type: String, ref: EvaluationRef }], default: [] }
})

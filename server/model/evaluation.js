import mongoose, { Schema } from 'mongoose'
import { Evaluation } from './index'

export const schema = new Schema({
  _id: { type: String, required: true, maxlength: 16, trim: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  min: { type: Number, default: 0 },
  max: { type: Number, required: true },
  step: { type: Number, min: 0, default: 0.5 }
}, { _id: false, autoCreate: true })

export default mongoose.model(Evaluation, schema)

import mongoose, { Schema } from 'mongoose'
import { Evaluation } from './index'

const choice = new Schema({
  name: { type: String, required: true, trim: true },
  score: { type: Number, required: true }
})

export const schema = new Schema({
  _id: { type: String, required: true, maxlength: 16, trim: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  value: { type: Number, required: true },
  choices: { type: [choice], required: true, validate: c => c.length > 0 }
}, { _id: false, autoCreate: true })

export default mongoose.model(Evaluation, schema)

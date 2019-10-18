import mongoose, { Schema } from 'mongoose'
import { Discipline } from './index'

export const schema = new Schema({
  _id: { type: String, required: true, maxlength: 16, trim: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  single: { type: Number, required: true },
  repeat: { type: Number, min: 1, default: 99 }
}, { _id: false, autoCreate: true })

export default mongoose.model(Discipline, schema)

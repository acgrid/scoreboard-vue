import mongoose, { Schema } from 'mongoose'
import { Candidate } from './index'

export const schema = new Schema({
  _id: { type: String, required: true, maxlength: 18, trim: true },
  seq: { type: Number },
  name: { type: String, required: true, trim: true },
  nickname: { type: String, trim: true }
}, { _id: false, autoCreate: true })

export default mongoose.model(Candidate, schema)

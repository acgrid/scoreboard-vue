import mongoose, { Schema } from 'mongoose'
import { Candidate } from './index'

export const schema = new Schema({
  name: { type: String, required: true, trim: true },
  nickname: { type: String, trim: true }
}, { autoCreate: true })

export default mongoose.model(Candidate, schema)

import mongoose, { Schema } from 'mongoose'
import { Judge } from './index'

export const schema = new Schema({
  _id: { type: String, required: true, maxlength: 16, trim: true },
  name: { type: String, required: true, maxlength: 32, trim: true },
  password: { type: String, required: true }
}, { _id: false, autoCreate: true })

export default mongoose.model(Judge, schema)

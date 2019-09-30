import boom from '@hapi/boom'
export default (model, id) => {
  return new Promise((resolve, reject) => {
    model.findById(id, (err, doc) => {
      if (err) return reject(boom.internal(err))
      return doc ? resolve(doc) : reject(boom.badRequest(`Referenced ${id} is not a valid ${model.modelName}.`))
    })
  })
}

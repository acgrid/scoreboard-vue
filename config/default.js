const production = process.env.NODE_ENV === 'production'
module.exports = {
  production,
  secure: true, // in case of API service is https proxy passed
  mongo: {
    dsn: `mongodb://${production ? 'mongodb:27017' : 'root:test@localhost:27017'}/scoreboard`,
    options: { authSource: 'admin', auth: { user: 'root', password: 'test' } }
  }
}

const toJSONPlugin = function (schema, options) {
  schema.set("toJSON", {
    virtuals: true,
    transform: (_doc, ret, _opts) => {
      ret.id = ret._id.toString()
      delete ret._id
      delete ret.__v
      if (ret.password) {
        ret.password = ret.password.toString().slice(0, 8) + "***"
      }
    },
  })
  if (options && options.stripPassword !== false) {
    schema.post("init", function (doc) {
      delete doc._doc.password
    })
  }
}

module.exports = toJSONPlugin
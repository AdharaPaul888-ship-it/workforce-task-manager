const mongoose = require("mongoose");
const toJSON = require("./plugins/toJSON");

const roleSchema = new mongoose.Schema(
  {
    tenant: { type: String, required: true, index: true },
    scope: { type: String, enum: ["self", "team", "department", "tenant"] },
    isSystem: { type: Boolean, default: false },
    name: { type: String, required: true, index: true },
    guard: { type: String, default: "api" },
    permissions: [{ type: String }],
  },
  { timestamps: true }
);

roleSchema.index({ tenant: 1, name: 1 }, { unique: true });

roleSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.model("Role", roleSchema);
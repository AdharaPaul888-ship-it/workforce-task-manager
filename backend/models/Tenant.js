const mongoose = require("mongoose");

const tenantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    domain: { type: String },
    currency: { type: String },
    timezone: { type: String, default: "Asia/Dhaka" },
    activePlan: { type: String },
  },
  { timestamps: true }
);

tenantSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.model("Tenant", tenantSchema);
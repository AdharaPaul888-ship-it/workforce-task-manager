const mongoose = require("mongoose");
const toJSON = require("./plugins/toJSON");

const taskPresetSchema = new mongoose.Schema(
  {
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name: { type: String, required: true },
    category: { type: String },
    freq: { type: String, enum: ["Daily", "Weekly", "Monthly", "Quarterly"] },
    target: { type: Number, required: true },
    role: { type: String },
    proofType: { type: String },
    status: { type: String, enum: ["Published", "Draft"], default: "Draft" },
  },
  { timestamps: true }
);

taskPresetSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.model("TaskPreset", taskPresetSchema);
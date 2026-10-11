const mongoose = require("mongoose");
const toJSON = require("./plugins/toJSON");

const departmentSchema = new mongoose.Schema(
  {
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name: { type: String, required: true },
    code: { type: String, required: true },
    budget: { type: Number },
    hod: { type: String },
    hodName: { type: String },
    teams: [
      {
        name: { type: String },
        lead: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        leadName: { type: String },
        members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      },
    ],
  },
  { timestamps: true }
);

departmentSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.model("Department", departmentSchema);
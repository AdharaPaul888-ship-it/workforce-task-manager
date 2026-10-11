const mongoose = require("mongoose");
const toJSON = require("./plugins/toJSON");

const holidaySchema = new mongoose.Schema(
  {
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    title: { type: String, required: true },
    date: { type: Date, required: true },
    type: { type: String, enum: ["National", "Religious", "Company"] },
    description: { type: String },
    day: { type: String },
  },
  { timestamps: true }
);

holidaySchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.model("Holiday", holidaySchema);
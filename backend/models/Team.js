const mongoose = require("mongoose");
const toJSON = require("./plugins/toJSON");

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "Department" },
  },
  { timestamps: true }
);

teamSchema.set("toJSON", {
  virtuals: true,
  transform: function (_doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.model("Team", teamSchema);
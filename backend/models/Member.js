const mongoose = require("mongoose");
const toJSON = require("./plugins/toJSON");

const memberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, unique: true },
    role: { type: String, enum: ["Super Admin", "Admin", "HR", "Manager", "Member"] },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "Department" },
    team: { type: mongoose.Schema.Types.ObjectId, ref: "Team" },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    phone: { type: String },
    empCode: { type: String },
  },
  { timestamps: true }
);

memberSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.model("Member", memberSchema);
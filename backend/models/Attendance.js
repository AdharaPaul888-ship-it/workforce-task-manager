const mongoose = require("mongoose");
const toJSON = require("./plugins/toJSON");

const attendanceSchema = new mongoose.Schema(
  {
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    userName: { type: String },
    date: { type: String, required: true },
    clockIn: { type: Date },
    clockOut: { type: Date },
    durationMinutes: { type: Number },
    status: {
      type: String,
      enum: ["Present", "Late", "Absent", "Half-Day", "Leave"],
      default: "Present",
    },
    location: { type: String },
    note: { type: String },
  },
  { timestamps: true }
);

attendanceSchema.index({ tenant: 1, user: 1, date: 1 }, { unique: true });

attendanceSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.model("Attendance", attendanceSchema);

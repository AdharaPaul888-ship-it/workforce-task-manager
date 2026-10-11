const mongoose = require("mongoose");
const toJSON = require("./plugins/toJSON");

const activeTimerSchema = new mongoose.Schema(
  {
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    task: { type: mongoose.Schema.Types.ObjectId, ref: "Task" },
    taskTitle: { type: String },
    startedAt: { type: Date, default: Date.now },
    lastResumedAt: { type: Date },
    accumulatedSeconds: { type: Number, default: 0 },
    running: { type: Boolean, default: false },
    idleDiscardedSeconds: { type: Number, default: 0 },
  },
  { timestamps: true }
);

activeTimerSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.model("ActiveTimer", activeTimerSchema);
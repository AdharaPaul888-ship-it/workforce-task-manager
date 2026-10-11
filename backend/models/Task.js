const mongoose = require("mongoose");
const toJSON = require("./plugins/toJSON");

const taskSchema = new mongoose.Schema(
  {
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    ownerName: { type: String },
    title: { type: String, required: true },
    desc: { type: String },
    category: {
      type: String,
      enum: ["Field Visit", "Sales", "Collection", "Admin", "Service"],
    },
    priority: { type: String, enum: ["Low", "Medium", "High", "Critical"] },
    status: { type: String, enum: ["Draft", "Submitted", "Approved", "Rejected"], default: "Draft" },
    due: { type: Date },
    progress: { type: Number, min: 0, max: 100 },
    hoursLogged: { type: Number },
    targetQuantity: { type: Number },
    completedQuantity: { type: Number },
    preset: { type: mongoose.Schema.Types.ObjectId, ref: "TaskPreset" },
    monthCycle: { type: String },
    proofAttachments: [
      {
        title: { type: String },
        fileName: { type: String },
        type: { type: String },
        gpsCoordinates: { type: String },
        geofenceStatus: { type: String },
        timestamp: { type: Date },
        previewUrl: { type: String },
      },
    ],
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewRemarks: { type: String },
  },
  { timestamps: true }
);

taskSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

taskSchema.index({ tenant: 1, owner: 1, monthCycle: 1 });
taskSchema.index({ tenant: 1, status: 1 });
taskSchema.index({ "$text": { score: { $meta: "textScore" } } });

module.exports = mongoose.model("Task", taskSchema);
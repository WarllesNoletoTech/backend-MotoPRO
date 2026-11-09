import mongoose from 'mongoose';

export interface GoalFields {
  userId: mongoose.Types.ObjectId;
  weeklyTargetCents: number;
}

const schema = new mongoose.Schema<GoalFields>({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, required: true },
  weeklyTargetCents: { type: Number, required: true, min: 100, max: 100_000_000 }
}, { timestamps: true });

// Evita que mongoose.models.Goal introduza um tipo de array na inferência.
export const Goal: mongoose.Model<GoalFields> =
  (mongoose.models.Goal as mongoose.Model<GoalFields> | undefined) ??
  mongoose.model<GoalFields>('Goal', schema);

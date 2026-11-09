import mongoose from 'mongoose';

/** Campos persistidos para a meta semanal do entregador. */
export interface GoalFields {
  userId: mongoose.Types.ObjectId;
  weeklyTargetCents: number;
}

const schema = new mongoose.Schema<GoalFields>({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, required: true },
  weeklyTargetCents: { type: Number, required: true, min: 100, max: 100_000_000 }
}, { timestamps: true });

// Mantém um único tipo de Model, evitando a união inferida pelo TS com models.Goal.
export const Goal: mongoose.Model<GoalFields> =
  (mongoose.models.Goal as mongoose.Model<GoalFields> | undefined) ??
  mongoose.model<GoalFields>('Goal', schema);

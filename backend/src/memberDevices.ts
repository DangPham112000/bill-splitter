import type mongoose from 'mongoose';
import { MemberDeviceModel, MemberModel, TransactionModel } from './models/index.js';

type MemberDoc = InstanceType<typeof MemberModel>;

/**
 * The member a device acts as in a splitter (DAN-41): the name it picked most recently that is
 * still active, or null if it never joined. A removed name no longer opens the splitter.
 */
export async function deviceMember(
  splitterId: mongoose.Types.ObjectId,
  deviceId: string | null,
): Promise<MemberDoc | null> {
  if (!deviceId) return null;
  const picks = await MemberDeviceModel.find({ splitterId, deviceId })
    .sort({ lastUsedAt: -1 })
    .select('memberId');
  if (!picks.length) return null;
  const active = await MemberModel.find({
    _id: { $in: picks.map((p) => p.memberId) },
    removedAt: null,
  });
  const byId = new Map(active.map((m) => [m._id.toString(), m]));
  for (const pick of picks) {
    const member = byId.get(pick.memberId.toString());
    if (member) return member;
  }
  return null;
}

/**
 * Ids of the members this device has been in a splitter: names it created, picked, or added
 * transactions as. The join screen lists them first.
 */
export async function membersUsedOnDevice(
  splitterId: mongoose.Types.ObjectId,
  deviceId: string | null,
): Promise<Set<string>> {
  if (!deviceId) return new Set();
  const [created, picked, added] = await Promise.all([
    MemberModel.find({ splitterId, createdByDeviceId: deviceId }).distinct('_id'),
    MemberDeviceModel.find({ splitterId, deviceId }).distinct('memberId'),
    TransactionModel.find({ splitterId, createdByDeviceId: deviceId }).distinct(
      'createdByMemberId',
    ),
  ]);
  return new Set([...created, ...picked, ...added].map((id) => id.toString()));
}

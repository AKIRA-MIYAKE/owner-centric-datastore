import { DynamoDB } from 'aws-sdk';

import { GroupEntity } from '../../interfaces';

import { ApplicationError } from '../../lib/error';

import {
  toEntityFromRecords,
  getGroupAndMemberRecords,
  putGroupAndOwnerMemberRecord,
} from '../../dynamodb/group';

import { getUser } from '../user';

export const isMember: (group: GroupEntity, userId: string) => boolean = (
  group,
  userId
) => {
  return (
    isOwner(group, userId) ||
    isProvider(group, userId) ||
    isConsumer(group, userId)
  );
};

export const isOwner: (group: GroupEntity, userId: string) => boolean = (
  group,
  userId
) => {
  return group.owners.some((m) => m.user_id === userId);
};

export const isProvider: (group: GroupEntity, userId: string) => boolean = (
  group,
  userId
) => {
  return group.providers.some((m) => m.user_id === userId);
};

export const isConsumer: (group: GroupEntity, userId: string) => boolean = (
  group,
  userId
) => {
  return group.consumers.some((m) => m.user_id === userId);
};

export const getGroup: (
  client: DynamoDB.DocumentClient,
  params: { userId: string; groupId: string }
) => Promise<GroupEntity | undefined> = async (client, { userId, groupId }) => {
  const records = await getGroupAndMemberRecords(client, { groupId });

  if (records.length === 0) {
    return undefined;
  }

  const group = toEntityFromRecords(records);

  if (!isMember(group, userId)) {
    return undefined;
  }

  return group;
};

export const createGroup: (
  client: DynamoDB.DocumentClient,
  params: { userId: string; name: string }
) => Promise<GroupEntity> = async (client, { userId, name }) => {
  const user = await getUser(client, { userId });

  if (!user) {
    throw new ApplicationError('User registration required');
  }

  const records = await putGroupAndOwnerMemberRecord(client, {
    groupName: name,
    userId: user.id,
    userNickname: user.nickname,
  });

  return toEntityFromRecords(records);
};

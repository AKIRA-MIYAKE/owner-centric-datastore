import { DynamoDB } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';

import {
  Record,
  UserEntity,
  GroupEntity,
  GroupUser,
  GroupRecord,
  GroupUserRecord,
  GroupUserRole,
} from '../../interfaces';

import { queryAll } from '../../lib/dynamodb';

export function isGroupRecord(record: Record): record is GroupRecord {
  const hk = record.hash_key.split('/').map((s) => s.split(':'));

  return record.hash_key === record.range_key && hk[0][0] === 'group';
}

export function isGroupUserRecord(record: Record): record is GroupUserRecord {
  const hk = record.hash_key.split('/').map((s) => s.split(':'));
  const rk = record.range_key.split('/').map((s) => s.split(':'));

  return (
    hk.length == 1 &&
    hk[0][0] === 'group' &&
    rk.length === 3 &&
    rk[0][0] === 'group' &&
    rk[1][0] === 'role' &&
    rk[2][0] === 'user'
  );
}

export const isGroupUser: (group: GroupEntity, userId: string) => boolean = (
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
  return group.owners.some((gu) => gu.user_id === userId);
};

export const isProvider: (group: GroupEntity, userId: string) => boolean = (
  group,
  userId
) => {
  return group.providers.some((gu) => gu.user_id === userId);
};

export const isConsumer: (group: GroupEntity, userId: string) => boolean = (
  group,
  userId
) => {
  return group.consumers.some((gu) => gu.user_id === userId);
};

export const toEntityFromRecords: (
  records: Array<GroupRecord | GroupUserRecord>
) => GroupEntity = (records) => {
  const groupRecord = records.find((record) => isGroupRecord(record)) as
    | GroupRecord
    | undefined;

  if (!groupRecord) {
    throw new Error('Something wrong');
  }

  const groupUserRecords = records.filter((record) =>
    isGroupUserRecord(record)
  ) as GroupUserRecord[];

  const groupUsers = groupUserRecords.map((record) => toGroupUser(record));

  return {
    id: groupRecord.id,
    name: groupRecord.name,
    owners: groupUsers.filter((gu) => gu.role === 'owner'),
    providers: groupUsers.filter((gu) => gu.role === 'provider'),
    consumers: groupUsers.filter((gu) => gu.role === 'consumer'),
    updated_at: groupRecord.updated_at,
    created_at: groupRecord.created_at,
  };
};

export const toGroupUser: (record: GroupUserRecord) => GroupUser = (record) => {
  return {
    group_id: record.group_id,
    group_name: record.group_name,
    user_id: record.user_id,
    user_nickname: record.user_nickname,
    role: record.role,
  };
};

export const getGroup: (
  client: DynamoDB.DocumentClient,
  params: { id: string }
) => Promise<GroupEntity | undefined> = async (client, { id }) => {
  const items = await queryAll(client, {
    TableName: process.env.DYNAMODB!,  // eslint-disable-line
    KeyConditionExpression: 'hash_key = :hk',
    ExpressionAttributeValues: {
      ':hk': `group:${id}`,
    },
  });

  if (items.length === 0) {
    return undefined;
  }

  const records = items as Array<GroupRecord | GroupUserRecord>;

  return toEntityFromRecords(records);
};

export const createGroup: (
  client: DynamoDB.DocumentClient,
  params: { user: UserEntity; name: string }
) => Promise<GroupEntity> = async (client, { user, name }) => {
  const id = uuidv4();
  const now = dayjs();

  const userId = user.id;

  const groupRecord: GroupRecord = {
    id: id,
    name,
    updated_at: now.toISOString(),
    created_at: now.toISOString(),
    hash_key: `group:${id}`,
    range_key: `group:${id}`,
  };

  const ownerGroupUserRecord: GroupUserRecord = {
    group_id: id,
    group_name: name,
    user_id: userId,
    user_nickname: user.nickname,
    role: 'owner',
    hash_key: `group:${id}`,
    range_key: `group:${id}/role:owner/user:${userId}`,
    gsi_hash_key_0: `user:${userId}/group`,
    gsi_range_key_0: `role:owner/group:${id}`,
  };

  await client
    .transactWrite({
      TransactItems: [
        {
          Put: {
            TableName: process.env.DYNAMODB!,  // eslint-disable-line
            Item: groupRecord,
          },
        },
        {
          Put: {
            TableName: process.env.DYNAMODB!,  // eslint-disable-line
            Item: ownerGroupUserRecord,
          },
        },
      ],
    })
    .promise();

  return toEntityFromRecords([groupRecord, ownerGroupUserRecord]);
};

export const findGroupUserByUserId: (
  client: DynamoDB.DocumentClient,
  params: { userId: string }
) => Promise<GroupUser[]> = async (client, { userId }) => {
  const items = await queryAll(client, {
    TableName: process.env.DYNAMODB!,  // eslint-disable-line
    IndexName: 'gsi_0',
    KeyConditionExpression: 'gsi_hash_key_0 = :gsi_hk_0',
    ExpressionAttributeValues: {
      ':gsi_hk_0': `user:${userId}/group`,
    },
  });

  const records = items as GroupUserRecord[];

  return records.map((record) => toGroupUser(record));
};

export const findGroupUserByUserIdWithRole: (
  client: DynamoDB.DocumentClient,
  params: { userId: string; role: GroupUserRole }
) => Promise<GroupUser[]> = async (client, { userId, role }) => {
  const items = await queryAll(client, {
    TableName: process.env.DYNAMODB!,  // eslint-disable-line
    IndexName: 'gsi_0',
    KeyConditionExpression:
      'gsi_hash_key_0 = :gsi_hk_0 and begins_with(gsi_range_key_0, :gsi_rk_0)',
    ExpressionAttributeValues: {
      ':gsi_hk_0': `user:${userId}/group`,
      ':gsi_rk_0': `role:${role}`,
    },
  });

  const records = items as GroupUserRecord[];

  return records.map((record) => toGroupUser(record));
};

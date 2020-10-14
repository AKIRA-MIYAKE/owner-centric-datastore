import { DynamoDB } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';

import {
  Record,
  UserEntity,
  GroupEntity,
  MemberEntity,
  GroupRecord,
  MemberRecord,
  MemberRole,
} from '../../interfaces';

import { queryAll } from '../../lib/dynamodb';

export function isGroupRecord(record: Record): record is GroupRecord {
  const hk = record.hash_key.split('/').map((s) => s.split(':'));

  return record.hash_key === record.range_key && hk[0][0] === 'group';
}

export function isMemberRecord(record: Record): record is MemberRecord {
  const hk = record.hash_key.split('/').map((s) => s.split(':'));
  const rk = record.range_key.split('/').map((s) => s.split(':'));

  return (
    hk.length == 1 &&
    hk[0][0] === 'group' &&
    rk.length === 3 &&
    rk[0][0] === 'group' &&
    rk[1][0] === 'role' &&
    rk[2][0] === 'member'
  );
}

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
  records: Array<GroupRecord | MemberRecord>
) => GroupEntity = (records) => {
  const groupRecord = records.find((record) => isGroupRecord(record)) as
    | GroupRecord
    | undefined;

  if (!groupRecord) {
    throw new Error('Something wrong');
  }

  const MemberRecords = records.filter((record) =>
    isMemberRecord(record)
  ) as MemberRecord[];

  const Members = MemberRecords.map((record) => toMemberEntity(record));

  return {
    id: groupRecord.id,
    name: groupRecord.name,
    owners: Members.filter((gu) => gu.role === 'owner'),
    providers: Members.filter((gu) => gu.role === 'provider'),
    consumers: Members.filter((gu) => gu.role === 'consumer'),
    updated_at: groupRecord.updated_at,
    created_at: groupRecord.created_at,
  };
};

export const toMemberEntity: (record: MemberRecord) => MemberEntity = (
  record
) => {
  return {
    id: record.id,
    group_id: record.group_id,
    group_name: record.group_name,
    user_id: record.user_id,
    user_nickname: record.user_nickname,
    role: record.role,
    updated_at: record.updated_at,
    created_at: record.created_at,
  };
};

export const getGroup: (
  client: DynamoDB.DocumentClient,
  params: { id: string }
) => Promise<GroupEntity | undefined> = async (client, params) => {
  const records = await getGroupRecords(client, params);

  if (records.length === 0) {
    return undefined;
  }

  return toEntityFromRecords(records);
};

export const getGroupRecords: (
  client: DynamoDB.DocumentClient,
  params: { id: string }
) => Promise<Array<GroupRecord | MemberRecord>> = async (client, { id }) => {
  const items = await queryAll(client, {
    TableName: process.env.DYNAMODB!,  // eslint-disable-line
    KeyConditionExpression: 'hash_key = :hk',
    ExpressionAttributeValues: {
      ':hk': `group:${id}`,
    },
  });

  return items as Array<GroupRecord | MemberRecord>;
};

export const createGroup: (
  client: DynamoDB.DocumentClient,
  params: { user: UserEntity; name: string }
) => Promise<GroupEntity> = async (client, { user, name }) => {
  const id = uuidv4();
  const MemberId = uuidv4();
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

  const ownerMemberRecord: MemberRecord = {
    id: MemberId,
    group_id: id,
    group_name: name,
    user_id: userId,
    user_nickname: user.nickname,
    role: 'owner',
    updated_at: now.toISOString(),
    created_at: now.toISOString(),
    hash_key: `group:${id}`,
    range_key: `group:${id}/role:owner/member:${MemberId}`,
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
            Item: ownerMemberRecord,
          },
        },
      ],
    })
    .promise();

  return toEntityFromRecords([groupRecord, ownerMemberRecord]);
};

export const findMemberByUserId: (
  client: DynamoDB.DocumentClient,
  params: { userId: string }
) => Promise<MemberEntity[]> = async (client, params) => {
  const records = await queryMemberRecordByUserId(client, params);

  return records.map((record) => toMemberEntity(record));
};

export const queryMemberRecordByUserId: (
  client: DynamoDB.DocumentClient,
  params: { userId: string }
) => Promise<MemberRecord[]> = async (client, { userId }) => {
  const items = await queryAll(client, {
    TableName: process.env.DYNAMODB!,  // eslint-disable-line
    IndexName: 'gsi_0',
    KeyConditionExpression: 'gsi_hash_key_0 = :gsi_hk_0',
    ExpressionAttributeValues: {
      ':gsi_hk_0': `user:${userId}/group`,
    },
  });

  return items as MemberRecord[];
};

export const findMemberByUserIdWithRole: (
  client: DynamoDB.DocumentClient,
  params: { userId: string; role: MemberRole }
) => Promise<MemberEntity[]> = async (client, params) => {
  const records = await queryMemberRecordByUserIdWithRole(client, params);

  return records.map((record) => toMemberEntity(record));
};

export const queryMemberRecordByUserIdWithRole: (
  client: DynamoDB.DocumentClient,
  params: { userId: string; role: MemberRole }
) => Promise<MemberRecord[]> = async (client, { userId, role }) => {
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

  return items as MemberRecord[];
};

import { DynamoDB } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';

import {
  GroupEntity,
  Record,
  GroupRecord,
  MemberRecord,
} from '../../interfaces';

import { queryAll } from '../../lib/dynamodb';

import { toEntity as toMemberEntity, isMemberRecord } from '../member';

export function isGroupRecord(record: Record): record is GroupRecord {
  const hk = record.hash_key.split('/').map((s) => s.split(':'));

  return record.hash_key === record.range_key && hk[0][0] === 'group';
}

export const toEntityFromRecords: (
  records: Array<GroupRecord | MemberRecord>
) => GroupEntity = (records) => {
  const groupRecord = records.find((record) => isGroupRecord(record)) as
    | GroupRecord
    | undefined;

  if (!groupRecord) {
    throw new Error('Something wrong');
  }

  const memberRecords = records.filter((record) =>
    isMemberRecord(record)
  ) as MemberRecord[];

  const members = memberRecords.map((record) => toMemberEntity(record));

  return {
    id: groupRecord.id,
    name: groupRecord.name,
    owners: members.filter((m) => m.role === 'owner'),
    providers: members.filter((m) => m.role === 'provider'),
    consumers: members.filter((m) => m.role === 'consumer'),
    updated_at: groupRecord.updated_at,
    created_at: groupRecord.created_at,
  };
};

export const getGroupAndMemberRecords: (
  client: DynamoDB.DocumentClient,
  params: { groupId: string }
) => Promise<Array<GroupRecord | MemberRecord>> = async (
  client,
  { groupId }
) => {
  const items = await queryAll(client, {
    TableName: process.env.DYNAMODB!,  // eslint-disable-line
    KeyConditionExpression: 'hash_key = :hk',
    ExpressionAttributeValues: {
      ':hk': `group:${groupId}`,
    },
  });

  return items as Array<GroupRecord | MemberRecord>;
};

export const putGroupAndOwnerMemberRecord: (
  client: DynamoDB.DocumentClient,
  params: { groupName: string; userId: string; userNickname: string }
) => Promise<Array<GroupRecord | MemberRecord>> = async (
  client,
  { groupName, userId, userNickname }
) => {
  const groupId = uuidv4();
  const memberId = uuidv4();
  const now = dayjs();

  const groupRecord: GroupRecord = {
    id: groupId,
    name: groupName,
    updated_at: now.toISOString(),
    created_at: now.toISOString(),
    hash_key: `group:${groupId}`,
    range_key: `group:${groupId}`,
  };

  const ownerMemberRecord: MemberRecord = {
    id: memberId,
    group_id: groupId,
    group_name: groupName,
    user_id: userId,
    user_nickname: userNickname,
    role: 'owner',
    updated_at: now.toISOString(),
    created_at: now.toISOString(),
    hash_key: `group:${groupId}`,
    range_key: `group:${groupId}/role:owner/member:${memberId}`,
    gsi_hash_key_0: `user:${userId}/group`,
    gsi_range_key_0: `role:owner/group:${groupId}`,
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

  return [groupRecord, ownerMemberRecord];
};

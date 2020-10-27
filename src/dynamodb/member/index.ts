import { DynamoDB } from 'aws-sdk';

import {
  MemberEntity,
  MemberRole,
  Record,
  MemberRecord,
} from '../../interfaces';

import { queryAll } from '../../lib/dynamodb';

export function isMemberRecord(record: Record): record is MemberRecord {
  const hk = record.hash_key.split('/').map((s) => s.split(':'));
  const rk = record.range_key.split('/').map((s) => s.split(':'));

  return (
    hk.length == 1 &&
    hk[0][0] === 'group' &&
    rk.length === 2 &&
    rk[0][0] === 'group' &&
    rk[1][0] === 'member'
  );
}

export const toEntity: (record: MemberRecord) => MemberEntity = (record) => {
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

export const queryMemberRecordsByUserId: (
  client: DynamoDB.DocumentClient,
  params: { userId: string }
) => Promise<MemberRecord[]> = async (client, { userId }) => {
  const items = await queryAll(client, {
    TableName: process.env.DYNAMODB!,  // eslint-disable-line
    IndexName: 'gsi_0',
    KeyConditionExpression: 'gsi_hash_key_0 = :gsi_hk_0',
    ExpressionAttributeValues: {
      ':gsi_hk_0': `user:${userId}/member`,
    },
  });

  return items as MemberRecord[];
};

export const queryMemberRecordsByUserIdWithRole: (
  client: DynamoDB.DocumentClient,
  params: { userId: string; role: MemberRole }
) => Promise<MemberRecord[]> = async (client, { userId, role }) => {
  const items = await queryAll(client, {
    TableName: process.env.DYNAMODB!,  // eslint-disable-line
    IndexName: 'gsi_0',
    KeyConditionExpression:
      'gsi_hash_key_0 = :gsi_hk_0 and begins_with(gsi_range_key_0, :gsi_rk_0)',
    ExpressionAttributeValues: {
      ':gsi_hk_0': `user:${userId}/member`,
      ':gsi_rk_0': `role:${role}`,
    },
  });

  return items as MemberRecord[];
};

export const deleteMemberRecord: (
  client: DynamoDB.DocumentClient,
  params: { groupId: string; memberId: string }
) => Promise<void> = async (client, { groupId, memberId }) => {
  await client
    .delete({
      TableName: process.env.DYNAMODB!,  // eslint-disable-line
      Key: {
        hash_key: `group:${groupId}`,
        range_key: `group:${groupId}/member:${memberId}`,
      },
    })
    .promise();
};

import { DynamoDB } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';

import {
  InvitationEntity,
  InvitationStatus,
  MemberRole,
  Record,
  InvitationRecord,
  MemberRecord,
} from '../../interfaces';

import { queryAll } from '../../lib/dynamodb';

export function isInvitationRecord(record: Record): record is InvitationRecord {
  const hk = record.hash_key.split('/').map((s) => s.split(':'));
  const rk = record.range_key.split('/').map((s) => s.split(':'));

  return (
    hk.length === 2 && hk[1].length === 1 && hk[0][0] === 'group',
    hk[1][0] === 'invitation' &&
      rk.length == 2 &&
      rk[1].length === 2 &&
      rk[0][0] === 'group' &&
      rk[1][0] === 'invitation'
  );
}

export const toEntity: (record: InvitationRecord) => InvitationEntity = (
  record
) => {
  return {
    id: record.id,
    group_id: record.group_id,
    group_name: record.group_name,
    user_id: record.user_id,
    user_nickname: record.user_nickname,
    role: record.role,
    status: record.status,
    updated_at: record.updated_at,
    created_at: record.created_at,
  };
};

export const getInvitationRecord: (
  client: DynamoDB.DocumentClient,
  params: { groupId: string; invitationId: string }
) => Promise<InvitationRecord | undefined> = async (
  client,
  { groupId, invitationId }
) => {
  const result = await client
    .get({
    TableName: process.env.DYNAMODB!,  // eslint-disable-line
      Key: {
        hash_key: `group:${groupId}/invitation`,
        range_key: `group:${groupId}/invitation:${invitationId}`,
      },
    })
    .promise();

  return result.Item && (result.Item as InvitationRecord);
};

export const queryInvitationRecordsByGroupId: (
  client: DynamoDB.DocumentClient,
  params: { groupId: string }
) => Promise<InvitationRecord[]> = async (client, { groupId }) => {
  const items = await queryAll(client, {
    TableName: process.env.DYNAMODB!,  // eslint-disable-line
    KeyConditionExpression: 'hash_key = :hk',
    ExpressionAttributeValues: {
      ':hk': `group:${groupId}/invitation`,
    },
  });

  return items as InvitationRecord[];
};

export const queryInvitationRecordsByGroupIdWithStatus: (
  client: DynamoDB.DocumentClient,
  params: { groupId: string; status: InvitationStatus }
) => Promise<InvitationRecord[]> = async (client, { groupId, status }) => {
  const items = await queryAll(client, {
    TableName: process.env.DYNAMODB!,  // eslint-disable-line
    IndexName: 'lsi_0',
    KeyConditionExpression: `hash_key = :hk and begins_with(lsi_range_key_0, :lsi_rk_0)`,
    ExpressionAttributeValues: {
      ':hk': `group:${groupId}/invitation`,
      ':lsi_rk_0': `status:${status}`,
    },
  });

  return items as InvitationRecord[];
};

export const queryInvitationRecordsByUserId: (
  client: DynamoDB.DocumentClient,
  params: { userId: string }
) => Promise<InvitationRecord[]> = async (client, { userId }) => {
  const items = await queryAll(client, {
    TableName: process.env.DYNAMODB!,  // eslint-disable-line
    IndexName: 'gsi_0',
    KeyConditionExpression: 'gsi_hash_key_0 = :gsi_hk_0',
    ExpressionAttributeValues: {
      ':gsi_hk_0': `user:${userId}/invitation`,
    },
  });

  return items as InvitationRecord[];
};

export const queryInvitationRecordsByUserIdWithStatus: (
  client: DynamoDB.DocumentClient,
  params: { userId: string; status: InvitationStatus }
) => Promise<InvitationRecord[]> = async (client, { userId, status }) => {
  const items = await queryAll(client, {
    TableName: process.env.DYNAMODB!,  // eslint-disable-line
    IndexName: 'gsi_0',
    KeyConditionExpression:
      'gsi_hash_key_0 = :gsi_hk_0  begins_with(gsi_range_key_0, :gsi_rk_0)',
    ExpressionAttributeValues: {
      ':gsi_hk_0': `user:${userId}/invitation`,
      ':gsi_rk_0': `status:${status}`,
    },
  });

  return items as InvitationRecord[];
};

export const putInvitationRecord: (
  client: DynamoDB.DocumentClient,
  params: {
    groupId: string;
    groupName: string;
    userId: string;
    userNickname: string;
    memberRole: MemberRole;
  }
) => Promise<InvitationRecord> = async (
  client,
  { groupId, groupName, userId, userNickname, memberRole }
) => {
  const invitationId = uuidv4();
  const now = dayjs();

  const record: InvitationRecord = {
    id: invitationId,
    group_id: groupId,
    group_name: groupName,
    user_id: userId,
    user_nickname: userNickname,
    role: memberRole,
    status: 'pending',
    updated_at: now.toISOString(),
    created_at: now.toISOString(),
    hash_key: `group:${groupId}/invitation`,
    range_key: `group:${groupId}/invitation:${invitationId}`,
    lsi_range_key_0: 'status:pending',
    gsi_hash_key_0: `user:${userId}/invitation`,
    gsi_range_key_0: `status:pending/group:${groupId}/invitation:${invitationId}`,
  };

  await client
    .put({
      TableName: process.env.DYNAMODB!,  // eslint-disable-line
      Item: record,
    })
    .promise();

  return record;
};

export const updateInvitationRecordWithAcceptStatusAndCreateMemberRecord: (
  client: DynamoDB.DocumentClient,
  params: {
    groupId: string;
    invitationId: string;
    groupName: string;
    userId: string;
    userNickname: string;
    memberRole: MemberRole;
  }
) => Promise<
  [{ status: InvitationStatus; updated_at: string }, MemberRecord]
> = async (
  client,
  { groupId, invitationId, groupName, userId, userNickname, memberRole }
) => {
  const memberId = uuidv4();
  const now = dayjs();

  const memberRecord: MemberRecord = {
    id: memberId,
    group_id: groupId,
    group_name: groupName,
    user_id: userId,
    user_nickname: userNickname,
    role: memberRole,
    updated_at: now.toISOString(),
    created_at: now.toISOString(),
    hash_key: `group:${groupId}`,
    range_key: `group:${groupId}/role:${memberRole}/member:${memberId}`,
    gsi_hash_key_0: `user:${userId}/group`,
    gsi_range_key_0: `role:${memberRole}/group/${groupId}`,
  };

  await client
    .transactWrite({
      TransactItems: [
        {
          Update: {
            TableName: process.env.DYNAMODB!,  // eslint-disable-line
            Key: {
              hash_key: `group:${groupId}/invitation`,
              range_key: `group:${groupId}/invitation:${invitationId}`,
            },
            UpdateExpression:
              'SET #status = :status, updated_at = :updated_at, lsi_range_key_0 = :lsi_rk_0, gsi_range_key_0 = :gsi_rk_0',
            ExpressionAttributeNames: {
              '#status': 'status',
            },
            ExpressionAttributeValues: {
              ':status': 'accept',
              ':updated_at': now.toISOString(),
              ':lsi_rk_0': 'status:accept',
              ':gsi_rk_0': `status:accept/group:${groupId}/invitation:${invitationId}`,
            },
          },
        },
        {
          Put: {
            TableName: process.env.DYNAMODB!,  // eslint-disable-line
            Item: memberRecord,
          },
        },
      ],
    })
    .promise();

  return [{ status: 'accept', updated_at: now.toISOString() }, memberRecord];
};

export const updateInvitationRecordWithDeclienStatus: (
  client: DynamoDB.DocumentClient,
  params: { groupId: string; invitationId: string }
) => Promise<{ status: InvitationStatus; updated_at: string }> = async (
  client,
  { groupId, invitationId }
) => {
  const now = dayjs();

  await client
    .update({
      TableName: process.env.DYNAMODB!,  // eslint-disable-line
      Key: {
        hash_key: `group:${groupId}/invitation`,
        range_key: `group:${groupId}/invitation:${invitationId}`,
      },
      UpdateExpression:
        'SET #status = :status, updated_at = :updated_at, lsi_range_key_0 = :lsi_rk_0, gsi_range_key_0 = :gsi_rk_0',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': 'decline',
        ':updated_at': now.toISOString(),
        ':lsi_rk_0': 'status:decline',
        ':gsi_rk_0': `status:decline/group:${groupId}/invitation:${invitationId}`,
      },
    })
    .promise();

  return { status: 'decline', updated_at: now.toISOString() };
};

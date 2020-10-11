import { DynamoDB } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';

import {
  Record,
  UserEntity,
  GroupEntity,
  GroupUserRole,
  GroupUserRecord,
  InvitationEntity,
  InvitationRecord,
  InvitationStatus,
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

export const getInvitation: (
  client: DynamoDB.DocumentClient,
  params: { id: string; groupId: string }
) => Promise<InvitationEntity | undefined> = async (
  client,
  { id, groupId }
) => {
  const result = await client
    .get({
      TableName: process.env.DYNAMODB!,  // eslint-disable-line
      Key: {
        hash_key: `group:${groupId}/invitation`,
        range_key: `group:${groupId}/invitation:${id}`,
      },
    })
    .promise();

  if (!result.Item) {
    return undefined;
  }

  const record = result.Item as InvitationRecord;

  return toEntity(record);
};

export const createInvitation: (
  client: DynamoDB.DocumentClient,
  params: { group: GroupEntity; user: UserEntity; role: GroupUserRole }
) => Promise<InvitationEntity> = async (client, { group, user, role }) => {
  const id = uuidv4();
  const now = dayjs();

  const groupId = group.id;
  const userId = user.id;

  const record: InvitationRecord = {
    id,
    group_id: groupId,
    group_name: group.name,
    user_id: userId,
    user_nickname: user.nickname,
    role,
    status: 'pending',
    updated_at: now.toISOString(),
    created_at: now.toISOString(),
    hash_key: `group:${groupId}/invitation`,
    range_key: `group:${groupId}/invitation:${id}`,
    lsi_range_key_0: 'status:pending',
    gsi_hash_key_0: `user:${userId}/invitation`,
    gsi_range_key_0: `status:pending/group:${groupId}/invitation:${id}`,
  };

  await client
    .put({
      TableName: process.env.DYNAMODB!,  // eslint-disable-line
      Item: record,
    })
    .promise();

  return toEntity(record);
};

export const findInvitationByGroupId: (
  cleint: DynamoDB.DocumentClient,
  params: { groupId: string }
) => Promise<InvitationEntity[]> = async (client, { groupId }) => {
  const items = await queryAll(client, {
    TableName: process.env.DYNAMODB!,  // eslint-disable-line
    KeyConditionExpression: 'hash_key = :hk',
    ExpressionAttributeValues: {
      ':hk': `group:${groupId}/invitation`,
    },
  });

  const records = items as InvitationRecord[];

  return records.map((record) => toEntity(record));
};

export const findInvitationByGroupIdWithStatus: (
  client: DynamoDB.DocumentClient,
  params: { groupId: string; status: InvitationStatus }
) => Promise<InvitationEntity[]> = async (client, { groupId, status }) => {
  const items = await queryAll(client, {
    TableName: process.env.DYNAMODB!,  // eslint-disable-line
    IndexName: 'lsi_0',
    KeyConditionExpression: `hash_key = :hk and begins_with(lsi_range_key_0, :lsi_rk_0)`,
    ExpressionAttributeValues: {
      ':hk': `group:${groupId}/invitation`,
      ':lsi_rk_0': `status:${status}`,
    },
  });

  const records = items as InvitationRecord[];

  return records.map((record) => toEntity(record));
};

export const findInvitationByUserId: (
  client: DynamoDB.DocumentClient,
  params: { userId: string }
) => Promise<InvitationEntity[]> = async (client, { userId }) => {
  const items = await queryAll(client, {
    TableName: process.env.DYNAMODB!,  // eslint-disable-line
    IndexName: 'gsi_0',
    KeyConditionExpression: 'gsi_hash_key_0 = :gsi_hk_0',
    ExpressionAttributeValues: {
      ':gsi_hk_0': `user:${userId}/invitation`,
    },
  });

  const records = items as InvitationRecord[];

  return records.map((record) => toEntity(record));
};

export const findInvitationByUserIdWithStatus: (
  client: DynamoDB.DocumentClient,
  params: { userId: string; status: InvitationStatus }
) => Promise<InvitationEntity[]> = async (client, { userId, status }) => {
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

  const records = items as InvitationRecord[];

  return records.map((record) => toEntity(record));
};

export const acceptInvitation: (
  client: DynamoDB.DocumentClient,
  params: { invitation: InvitationEntity }
) => Promise<InvitationEntity> = async (client, { invitation }) => {
  const now = dayjs();

  const groupId = invitation.group_id;
  const userId = invitation.user_id;
  const role = invitation.role;
  const invitationId = invitation.id;

  const groupUserRecord: GroupUserRecord = {
    group_id: groupId,
    group_name: invitation.group_name,
    user_id: userId,
    user_nickname: invitation.user_nickname,
    role: role,
    hash_key: `group:${groupId}`,
    range_key: `group:${groupId}/role:${role}/user:${userId}`,
    gsi_hash_key_0: `user:${userId}/group`,
    gsi_range_key_0: `role:${role}/group/${groupId}`,
  };

  await client
    .transactWrite({
      TransactItems: [
        {
          Update: {
            TableName: process.env.DYNAMODB!,  // eslint-disable-line
            Key: {
              hash_key: `group:${groupId}`,
              range_key: `group:${groupId}`,
            },
            UpdateExpression: 'SET updated_at = :updated_at',
            ExpressionAttributeValues: {
              ':updated_at': now.toISOString(),
            },
          },
        },
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
            Item: groupUserRecord,
          },
        },
      ],
    })
    .promise();

  return {
    ...invitation,
    status: 'accept',
    updated_at: now.toISOString(),
  };
};

export const declineInvitation: (
  client: DynamoDB.DocumentClient,
  params: { invitation: InvitationEntity }
) => Promise<InvitationEntity> = async (client, { invitation }) => {
  const now = dayjs();

  const groupId = invitation.group_id;
  const invitationId = invitation.id;

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

  return {
    ...invitation,
    status: 'decline',
    updated_at: now.toISOString(),
  };
};

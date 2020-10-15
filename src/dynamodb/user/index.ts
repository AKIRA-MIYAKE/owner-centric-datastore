import { DynamoDB } from 'aws-sdk';
import dayjs from 'dayjs';

import { UserEntity, Record, UserRecord } from '../../interfaces';

export function isUserRecord(record: Record): record is UserRecord {
  const hk = record.hash_key.split('/').map((s) => s.split(':'));

  return record.hash_key === record.range_key && hk[0][0] === 'user';
}

export const toEntity: (record: UserRecord) => UserEntity = (record) => {
  return {
    id: record.id,
    nickname: record.nickname,
    updated_at: record.updated_at,
    created_at: record.created_at,
  };
};

export const getUserRecord: (
  client: DynamoDB.DocumentClient,
  params: { userId: string }
) => Promise<UserRecord | undefined> = async (client, { userId }) => {
  const result = await client
    .get({
      TableName: process.env.DYNAMODB!,  // eslint-disable-line
      Key: {
        hash_key: `user:${userId}`,
        range_key: `user:${userId}`,
      },
    })
    .promise();

  return result.Item && (result.Item as UserRecord);
};

export const putUserRecord: (
  client: DynamoDB.DocumentClient,
  params: { userId: string; nickname: string }
) => Promise<UserRecord> = async (client, { userId, nickname }) => {
  const now = dayjs();

  const record: UserRecord = {
    id: userId,
    nickname,
    updated_at: now.toISOString(),
    created_at: now.toISOString(),
    hash_key: `user:${userId}`,
    range_key: `user:${userId}`,
  };

  await client
    .put({
      TableName: process.env.DYNAMODB!,  // eslint-disable-line
      Item: record,
      ConditionExpression: 'attribute_not_exists(hash_key)',
    })
    .promise();

  return record;
};

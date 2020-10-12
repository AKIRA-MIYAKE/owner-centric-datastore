import { DynamoDB } from 'aws-sdk';
import dayjs from 'dayjs';

import { Record, UserEntity, UserRecord } from '../../interfaces';

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

export const getUser: (
  client: DynamoDB.DocumentClient,
  params: { id: string }
) => Promise<UserEntity | undefined> = async (client, params) => {
  const record = await getUserRecord(client, params);

  return record && toEntity(record);
};

export const getUserRecord: (
  client: DynamoDB.DocumentClient,
  params: { id: string }
) => Promise<UserRecord | undefined> = async (client, { id }) => {
  const result = await client
    .get({
      TableName: process.env.DYNAMODB!,  // eslint-disable-line
      Key: {
        hash_key: `user:${id}`,
        range_key: `user:${id}`,
      },
    })
    .promise();

  if (!result.Item) {
    return undefined;
  }

  return result.Item as UserRecord;
};

export const createUser: (
  client: DynamoDB.DocumentClient,
  params: { id: string; nickname: string }
) => Promise<UserEntity | undefined> = async (client, { id, nickname }) => {
  const now = dayjs();

  const record: UserRecord = {
    id,
    nickname,
    updated_at: now.toISOString(),
    created_at: now.toISOString(),
    hash_key: `user:${id}`,
    range_key: `user:${id}`,
  };

  await client
    .put({
      TableName: process.env.DYNAMODB!,  // eslint-disable-line
      Item: record,
      ConditionExpression: 'attribute_not_exists(hash_key)',
    })
    .promise();

  return toEntity(record);
};

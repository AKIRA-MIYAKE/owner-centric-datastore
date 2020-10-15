import { DynamoDB } from 'aws-sdk';

import { UserEntity } from '../../interfaces';

import { ApplicationError } from '../../lib/error';

import { toEntity, getUserRecord, putUserRecord } from '../../dynamodb/user';

export const getUser: (
  client: DynamoDB.DocumentClient,
  params: { userId: string }
) => Promise<UserEntity | undefined> = async (client, { userId }) => {
  const record = await getUserRecord(client, { userId });

  return record && toEntity(record);
};

export const createUser: (
  client: DynamoDB.DocumentClient,
  params: { userId: string; nickname: string }
) => Promise<UserEntity> = async (client, { userId, nickname }) => {
  try {
    const record = await putUserRecord(client, { userId, nickname });

    return toEntity(record);
  } catch (error) {
    if (error.code === 'ConditionalCheckFailedException') {
      throw new ApplicationError('User already exists');
    } else {
      throw error;
    }
  }
};

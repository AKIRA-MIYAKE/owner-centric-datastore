import { DynamoDB } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';

import {
  DataEntity,
  isDateTypeDataPayload,
  isDatetimeTypeDataPayload,
  Record,
  DataRecord,
  DataPayload,
} from '../../interfaces';

import { queryAll } from '../../lib/dynamodb';
import { toDateISOString } from '../../lib/date';

export function isDataRecord(record: Record): record is DataRecord {
  const hk = record.hash_key.split('/').map((s) => s.split(':'));
  const rk = record.range_key.split('/').map((s) => s.split(':'));

  return (
    hk.length === 2 &&
    hk[1].length === 1 &&
    hk[0][0] === 'user' &&
    hk[1][0] === 'data' &&
    rk.length === 2 &&
    rk[1].length === 2 &&
    rk[0][0] === 'user' &&
    rk[1][0] === 'data'
  );
}

export const toEntity: (record: DataRecord) => DataEntity = (record) => {
  const payload = record.payload;

  if (isDateTypeDataPayload(payload)) {
    return {
      id: record.id,
      user_id: record.user_id,
      type: payload.type,
      value: payload.value,
      date: payload.date,
      updated_at: record.updated_at,
      created_at: record.created_at,
    };
  } else if (isDatetimeTypeDataPayload(payload)) {
    return {
      id: record.id,
      user_id: record.user_id,
      type: payload.type,
      value: payload.value,
      datetime: payload.datetime,
      updated_at: record.updated_at,
      created_at: record.created_at,
    };
  } else {
    throw new Error('Something wrong');
  }
};

export const getDataRecord: (
  client: DynamoDB.DocumentClient,
  params: { userId: string; dataId: string }
) => Promise<DataRecord | undefined> = async (client, { userId, dataId }) => {
  const result = await client
    .get({
      TableName: process.env.DYNAMODB!,  // eslint-disable-line
      Key: {
        hash_key: `user:${userId}/data`,
        range_key: `user:${userId}/data:${dataId}`,
      },
    })
    .promise();

  return result.Item && (result.Item as DataRecord);
};

export const queryDataRecordsByPeriod: (
  client: DynamoDB.DocumentClient,
  params: { userId: string; from: string; to: string }
) => Promise<DataRecord[]> = async (client, { userId, from, to }) => {
  const items = await queryAll(client, {
    TableName: process.env.DYNAMODB!,  // eslint-disable-line
    IndexName: 'lsi_0',
    KeyConditionExpression:
      'hash_key = :hk and lsi_range_key_0 BETWEEN :from AND :to',
    ExpressionAttributeValues: {
      ':hk': `user:${userId}/data`,
      ':from': from,
      ':to': to,
    },
  });
  console.log(items);
  return items as DataRecord[];
};

export const queryDataRecordsByPeriodWithDataType: (
  client: DynamoDB.DocumentClient,
  params: { userId: string; dataType: string; from: string; to: string }
) => Promise<DataRecord[]> = async (client, { userId, dataType, from, to }) => {
  const items = await queryAll(client, {
    TableName: process.env.DYNAMODB!,  // eslint-disable-line
    IndexName: 'gsi_0',
    KeyConditionExpression:
      'gsi_hash_key_0 = :gsi_hk_0 and gsi_range_key_0 BETWEEN :from AND :to',
    ExpressionAttributeValues: {
      ':gsi_hk_0': `user:${userId}/data/data_type:${dataType}`,
      ':from': from,
      ':to': to,
    },
  });

  return items as DataRecord[];
};

export const putDataRecord: (
  client: DynamoDB.DocumentClient,
  params: { userId: string; payload: DataPayload; timezone?: string }
) => Promise<DataRecord> = async (client, { userId, payload, timezone }) => {
  const id = uuidv4();
  const now = dayjs();

  let datetimeString: string;
  if (isDateTypeDataPayload(payload)) {
    datetimeString = toDateISOString(payload.date, {
      timezone,
    });
  } else if (isDatetimeTypeDataPayload(payload)) {
    datetimeString = dayjs(payload.datetime).toISOString();
  } else {
    throw new Error('Something wrong');
  }

  const record: DataRecord = {
    id,
    user_id: userId,
    payload,
    updated_at: now.toISOString(),
    created_at: now.toISOString(),
    hash_key: `user:${userId}/data`,
    range_key: `user:${userId}/data:${id}`,
    lsi_range_key_0: datetimeString,
    gsi_hash_key_0: `user:${userId}/data/data_type:${payload.type}`,
    gsi_range_key_0: datetimeString,
  };

  await client
    .put({
      TableName: process.env.DYNAMODB!,  // eslint-disable-line
      Item: record,
    })
    .promise();

  return record;
};

export const updateDataRecord: (
  client: DynamoDB.DocumentClient,
  params: {
    userId: string;
    dataId: string;
    payload: DataPayload;
    timezone?: string;
  }
) => Promise<{ updated_at: string }> = async (
  client,
  { userId, dataId, payload, timezone }
) => {
  const now = dayjs();

  let datetimeString: string;
  if (isDateTypeDataPayload(payload)) {
    datetimeString = toDateISOString(payload.date, {
      timezone,
    });
  } else if (isDatetimeTypeDataPayload(payload)) {
    datetimeString = dayjs(payload.datetime).toISOString();
  } else {
    throw new Error('Something wrong');
  }

  await client
    .update({
      TableName: process.env.DYNAMODB!,  // eslint-disable-line
      Key: {
        hash_key: `user:${userId}/data`,
        range_key: `user:${userId}/data:${dataId}`,
      },
      UpdateExpression:
        'SET payload = :payload, updated_at = :updated_at, lsi_range_key_0 = :lsi_rk_0, gsi_hash_key_0 = :gsi_hk_0, gsi_range_key_0 = :gsi_rk_0',
      ExpressionAttributeValues: {
        ':payload': payload,
        ':updated_at': now.toISOString(),
        ':lsi_rk_0': datetimeString,
        ':gsi_hk_0': `user:${userId}/data/data_type:${payload.type}`,
        ':gsi_rk_0': datetimeString,
      },
    })
    .promise();

  return { updated_at: now.toISOString() };
};

export const deleteDataRecord: (
  client: DynamoDB.DocumentClient,
  params: { userId: string; dataId: string }
) => Promise<void> = async (client, { userId, dataId }) => {
  await client
    .delete({
      TableName: process.env.DYNAMODB!,  // eslint-disable-line
      Key: {
        hash_key: `user:${userId}/data`,
        range_key: `user:${userId}/data:${dataId}`,
      },
    })
    .promise();
};

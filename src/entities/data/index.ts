import { DynamoDB } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';

import {
  Record,
  DataEntity,
  DataRecord,
  GroupDataRecord,
  DataPayload,
  isDateTypeDataPayload,
  isDatetimeTypeDataPayload,
} from '../../interfaces';

import { queryAll } from '../../lib/dynamodb';
import {
  validateDate,
  validateDatetime,
  toDateISOString,
} from '../../lib/date';

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

export function isGroupDataRecord(record: Record): record is GroupDataRecord {
  const hk = record.hash_key.split('/').map((s) => s.split(':'));
  const rk = record.range_key.split('/').map((s) => s.split(':'));

  return (
    hk.length === 2 &&
    hk[1].length === 1 &&
    hk[0][0] === 'group' &&
    hk[1][0] === 'data' &&
    rk.length === 2 &&
    rk[1].length === 2 &&
    rk[0][0] === 'user' &&
    rk[1][0] === 'data'
  );
}

export const validateDataPayload: (payload: DataPayload) => string[] = (
  payload
) => {
  const errorMessages: string[] = [];

  if (isDateTypeDataPayload(payload)) {
    errorMessages.push(...validateDate(payload.date));
  } else if (isDatetimeTypeDataPayload(payload)) {
    errorMessages.push(...validateDatetime(payload.datetime));
  } else {
    errorMessages.push('Something wrong');
  }

  return errorMessages;
};

export const getUserIdFromDataRecord: (record: DataRecord) => string = (
  record
) => {
  const hk = record.hash_key.split('/').map((s) => s.split(':'));

  return hk[0][1];
};

export const getUserIdFromGroupDataRecord: (
  record: GroupDataRecord
) => string = (record) => {
  const rk = record.range_key.split('/').map((s) => s.split(':'));

  return rk[1][1];
};

export const toEntity: (record: DataRecord) => DataEntity = (record) => {
  const payload = record.payload;

  if (isDateTypeDataPayload(payload)) {
    return {
      id: record.id,
      type: payload.type,
      value: payload.value,
      date: payload.date,
      updated_at: record.updated_at,
      created_at: record.created_at,
    };
  } else if (isDatetimeTypeDataPayload(payload)) {
    return {
      id: record.id,
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

export const getData: (
  client: DynamoDB.DocumentClient,
  params: { id: string; userId: string }
) => Promise<DataEntity | undefined> = async (client, { id, userId }) => {
  const result = await client
    .get({
      TableName: process.env.DYNAMODB!,  // eslint-disable-line
      Key: {
        hash_key: `user:${userId}/data`,
        range_key: `user:${userId}/data:${id}`,
      },
    })
    .promise();

  if (!result.Item) {
    return undefined;
  }

  const record = result.Item as DataRecord;

  return toEntity(record);
};

export const createData: (
  client: DynamoDB.DocumentClient,
  params: { userId: string; payload: DataPayload; timezone?: string }
) => Promise<DataEntity> = async (client, { userId, payload, timezone }) => {
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
    payload,
    updated_at: now.toISOString(),
    created_at: now.toISOString(),
    hash_key: `user:${userId}/data`,
    range_key: `user:${userId}/data:${id}`,
    lsi_range_key_0: datetimeString,
  };

  await client
    .put({
      TableName: process.env.DYNAMODB!,  // eslint-disable-line
      Item: record,
    })
    .promise();

  return toEntity(record);
};

export const findDataByPeriod: (
  client: DynamoDB.DocumentClient,
  params: { userId: string; from: string; to: string }
) => Promise<{ [type: string]: DataEntity[] }> = async (
  client,
  { userId, from, to }
) => {
  const items = await queryAll(client, {
    TableName: process.env.DYNAMODB!,  // eslint-disable-line
    IndexName: 'lsi_0',
    KeyConditionExpression:
      'hash_key = :hk and lsi_range_key_0 BETWEEN :from and :to',
    ExpressionAttributeValues: {
      ':hk': `user:${userId}/data`,
      ':from': from,
      ':to': to,
    },
  });

  const records = items as DataRecord[];

  const entities = records.map((record) => toEntity(record));

  return entities.reduce((acc, current) => {
    if (typeof acc[current.type] === 'undefined') {
      acc[current.type] = [current];
    } else {
      acc[current.type] = [...acc[current.type], current];
    }

    return acc;
  }, {} as { [type: string]: DataEntity[] });
};

export const createGroupData: (
  client: DynamoDB.DocumentClient,
  params: { dataRecord: DataRecord; groupId: string }
) => Promise<GroupDataRecord> = async (client, { dataRecord, groupId }) => {
  const dataId = dataRecord.id;
  const userId = dataRecord.hash_key.split('/').map((s) => s.split(':'))[0][1];

  const record: GroupDataRecord = {
    id: dataId,
    payload: dataRecord.payload,
    updated_at: dataRecord.updated_at,
    created_at: dataRecord.created_at,
    hash_key: `group:${groupId}/data`,
    range_key: `group:${groupId}/user:${userId}/data:${dataId}`,
    lsi_range_key_0: dataRecord.lsi_range_key_0,
  };

  await client
    .put({
      TableName: process.env.DYNAMODB!,  // eslint-disable-line
      Item: record,
    })
    .promise();

  return record;
};

export const findGroupDataByPeriod: (
  client: DynamoDB.DocumentClient,
  params: { groupId: string; from: string; to: string }
) => Promise<{ [type: string]: { [userId: string]: DataEntity[] } }> = async (
  client,
  { groupId, from, to }
) => {
  const items = await queryAll(client, {
    TableName: process.env.DYNAMODB!,  // eslint-disable-line
    IndexName: 'lsi_0',
    KeyConditionExpression:
      'hash_key = :hk and lsi_range_key_0 BETWEEN :from and :to',
    ExpressionAttributeValues: {
      ':hk': `group:${groupId}/data`,
      ':from': from,
      ':to': to,
    },
  });

  const records = items as GroupDataRecord[];

  return records.reduce((acc, current) => {
    const userId = getUserIdFromGroupDataRecord(current);
    const entity = toEntity(current);

    if (typeof acc[entity.type] === 'undefined') {
      acc[entity.type] = {
        [userId]: [entity],
      };
    } else {
      if (typeof acc[entity.type][userId] === 'undefined') {
        acc[entity.type] = {
          ...acc[entity.type],
          [userId]: [entity],
        };
      } else {
        acc[entity.type][userId] = [...acc[entity.type][userId], entity];
      }
    }

    return acc;
  }, {} as { [type: string]: { [userId: string]: DataEntity[] } });
};

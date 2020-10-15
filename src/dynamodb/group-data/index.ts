import { DynamoDB } from 'aws-sdk';

import {
  DataEntity,
  isDateTypeDataPayload,
  isDatetimeTypeDataPayload,
  Record,
  DataRecord,
  GroupDataRecord,
} from '../../interfaces';

import { queryAll, batchWriteAll } from '../../lib/dynamodb';

export function isGroupDataRecord(record: Record): record is GroupDataRecord {
  const hk = record.hash_key.split('/').map((s) => s.split(':'));
  const rk = record.range_key.split('/').map((s) => s.split(':'));

  return (
    hk.length === 2 &&
    hk[1].length === 1 &&
    hk[0][0] === 'group' &&
    hk[1][0] === 'data' &&
    rk.length === 3 &&
    rk[1].length === 2 &&
    rk[2].length === 2 &&
    rk[0][0] === 'group' &&
    rk[1][0] === 'user' &&
    rk[2][0] === 'data'
  );
}

export const toEntity: (record: GroupDataRecord) => DataEntity = (record) => {
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

export const convertToGroupDataRecord: (params: {
  dataRecord: DataRecord;
  groupId: string;
}) => GroupDataRecord = ({ dataRecord, groupId }) => {
  const dataId = dataRecord.id;
  const userId = dataRecord.user_id;

  return {
    id: dataId,
    user_id: userId,
    payload: dataRecord.payload,
    updated_at: dataRecord.updated_at,
    created_at: dataRecord.created_at,
    hash_key: `group:${groupId}/data`,
    range_key: `group:${groupId}/user:${userId}/data:${dataId}`,
    lsi_range_key_0: dataRecord.lsi_range_key_0,
    gsi_hash_key_0: `group:${groupId}/data/data_type:${dataRecord.payload.type}`,
    gsi_range_key_0: dataRecord.gsi_range_key_0,
  };
};

export const queryGroupDataRecordsByPeriod: (
  client: DynamoDB.DocumentClient,
  params: { groupId: string; from: string; to: string }
) => Promise<GroupDataRecord[]> = async (client, { groupId, from, to }) => {
  const items = await queryAll(client, {
    TableName: process.env.DYNAMODB!,  // eslint-disable-line
    IndexName: 'lsi_0',
    KeyConditionExpression:
      'hash_key = :hk and lsi_range_key_0 BETWEEN :from AND :to',
    ExpressionAttributeValues: {
      ':hk': `group:${groupId}/data`,
      ':from': from,
      ':to': to,
    },
  });

  return items as GroupDataRecord[];
};

export const queryGroupDataRecordsByPeriodWithDataType: (
  client: DynamoDB.DocumentClient,
  params: { groupId: string; dataType: string; from: string; to: string }
) => Promise<GroupDataRecord[]> = async (
  client,
  { groupId, dataType, from, to }
) => {
  const items = await queryAll(client, {
    TableName: process.env.DYNAMODB!,  // eslint-disable-line
    IndexName: 'gsi_0',
    KeyConditionExpression:
      'gsi_hash_key_0 = :gsi_hk_0 and gsi_range_key_0 BETWEEN :from AND :to',
    ExpressionAttributeValues: {
      ':gsi_hk_0': `group:${groupId}/data/data_type:${dataType}`,
      ':from': from,
      ':to': to,
    },
  });

  return items as GroupDataRecord[];
};

export const putGroupDataRecord: (
  client: DynamoDB.DocumentClient,
  params: { dataRecord: DataRecord; groupId: string }
) => Promise<GroupDataRecord> = async (client, { dataRecord, groupId }) => {
  const record = convertToGroupDataRecord({ dataRecord, groupId });

  await client
    .put({
      TableName: process.env.DYNAMODB!,  // eslint-disable-line
      Item: record,
    })
    .promise();

  return record;
};

export const batchPutGroupRecord: (
  client: DynamoDB.DocumentClient,
  params: { dataRecords: DataRecord[]; groupId: string }
) => Promise<void> = async (client, { dataRecords, groupId }) => {
  const records = dataRecords.map((dataRecord) =>
    convertToGroupDataRecord({ dataRecord, groupId })
  );

  await batchWriteAll(client, {
    RequestItems: {
      [process.env.DYNAMODB!]: records.map((record) => {  // eslint-disable-line
        return {
          PutRequest: {
            Item: record,
          },
        };
      }),
    },
  });
};

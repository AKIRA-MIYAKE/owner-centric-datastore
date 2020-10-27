import { DynamoDB } from 'aws-sdk';
import dayjs from 'dayjs';

import {
  DataEntity,
  DataPayload,
  isDateTypeDataPayload,
  isDatetimeTypeDataPayload,
} from '../../interfaces';

import {
  validateDate,
  validateDatetime,
  toDateISOString,
} from '../../lib/date';
import { NonExistentError } from '../../lib/error';

import {
  toEntity,
  getDataRecord,
  queryDataRecordsByPeriod,
  queryDataRecordsByPeriodWithDataType,
  putDataRecord,
  updateDataRecord,
  deleteDataRecord,
} from '../../dynamodb/data';

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

export const getData: (
  client: DynamoDB.DocumentClient,
  params: { userId: string; dataId: string }
) => Promise<DataEntity | undefined> = async (client, { userId, dataId }) => {
  const record = await getDataRecord(client, { userId, dataId });

  return record && toEntity(record);
};

export const findDataByPeriod: (
  client: DynamoDB.DocumentClient,
  params: { userId: string; from?: string; to?: string; timezone?: string }
) => Promise<{ [type: string]: DataEntity[] }> = async (
  client,
  { userId, from, to, timezone }
) => {
  const now = dayjs();

  const f = from
    ? toDateISOString(from, { timezone })
    : toDateISOString(now.subtract(7, 'day').format('YYYY-MM-DD'));
  const t = to
    ? toDateISOString(to, { timezone, isEndOf: true })
    : toDateISOString(now.format('YYYY-MM-DD'), { timezone, isEndOf: true });

  const records = await queryDataRecordsByPeriod(client, {
    userId,
    from: f,
    to: t,
  });

  const data = records.map((record) => toEntity(record));

  return data.reduce((acc, current) => {
    const type = current.type;

    if (!acc[type]) {
      acc[type] = [current];
    } else {
      acc[type] = [...acc[type], current];
    }

    return acc;
  }, {} as { [type: string]: DataEntity[] });
};

export const findDataByPeriodWithDataType: (
  client: DynamoDB.DocumentClient,
  params: {
    userId: string;
    dataType: string;
    from?: string;
    to?: string;
    timezone?: string;
  }
) => Promise<DataEntity[]> = async (
  client,
  { userId, dataType, from, to, timezone }
) => {
  const now = dayjs();

  const f = from
    ? toDateISOString(from, { timezone })
    : toDateISOString(now.subtract(7, 'day').format('YYYY-MM-DD'));
  const t = to
    ? toDateISOString(to, { timezone, isEndOf: true })
    : toDateISOString(now.format('YYYY-MM-DD'), { timezone, isEndOf: true });

  const records = await queryDataRecordsByPeriodWithDataType(client, {
    userId,
    dataType,
    from: f,
    to: t,
  });

  return records.map((record) => toEntity(record));
};

export const createData: (
  client: DynamoDB.DocumentClient,
  params: { userId: string; payload: DataPayload; timezone?: string }
) => Promise<DataEntity> = async (client, { userId, payload, timezone }) => {
  const record = await putDataRecord(client, { userId, payload, timezone });

  return toEntity(record);
};

export const patchData: (
  client: DynamoDB.DocumentClient,
  params: {
    userId: string;
    dataId: string;
    payload: DataPayload;
    timezone?: string;
  }
) => Promise<DataEntity> = async (
  client,
  { userId, dataId, payload, timezone }
) => {
  const record = await getDataRecord(client, { userId, dataId });

  if (!record) {
    throw new NonExistentError();
  }

  const { updated_at } = await updateDataRecord(client, {
    userId,
    dataId,
    payload,
    timezone,
  });

  const newRecord = { ...record, payload, updated_at };

  return toEntity(newRecord);
};

export const deleteData: (
  client: DynamoDB.DocumentClient,
  params: { userId: string; dataId: string }
) => Promise<void> = async (client, { userId, dataId }) => {
  const record = await getDataRecord(client, { userId, dataId });

  if (!record) {
    throw new NonExistentError();
  }

  await deleteDataRecord(client, { userId, dataId });
};

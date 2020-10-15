import { DynamoDB } from 'aws-sdk';
import dayjs from 'dayjs';

import { DataEntity } from '../../interfaces';

import { toDateISOString } from '../../lib/date';
import { PermissionError, NonExistentError } from '../../lib/error';

import {
  toEntity,
  queryGroupDataRecordsByPeriod,
  queryGroupDataRecordsByPeriodWithDataType,
} from '../../dynamodb/group-data';

import { isConsumer, getGroup } from '../group';

export const findGroupDataByPeriod: (
  client: DynamoDB.DocumentClient,
  params: {
    userId: string;
    groupId: string;
    from?: string;
    to?: string;
    timezone?: string;
  }
) => Promise<{ [type: string]: { [userId: string]: DataEntity[] } }> = async (
  client,
  { userId, groupId, from, to, timezone }
) => {
  const group = await getGroup(client, { userId, groupId });

  if (!group) {
    throw new NonExistentError();
  }

  if (!isConsumer(group, userId)) {
    throw new PermissionError();
  }

  const now = dayjs();

  const f = from
    ? toDateISOString(from, { timezone })
    : toDateISOString(now.subtract(7, 'day').format('YYYY-MM-DD'));
  const t = to
    ? toDateISOString(to, { timezone, isEndOf: true })
    : toDateISOString(now.format('YYYY-MM-DD'), { timezone, isEndOf: true });

  const records = await queryGroupDataRecordsByPeriod(client, {
    groupId,
    from: f,
    to: t,
  });

  const data = await records.map((record) => toEntity(record));

  return data.reduce((acc, current) => {
    const userId = current.user_id;
    const type = current.type;

    if (!acc[type]) {
      acc[type] = {
        [userId]: [current],
      };
    } else {
      if (!acc[type][userId]) {
        acc[type] = {
          ...acc[type],
          [userId]: [current],
        };
      } else {
        acc[type][userId] = [...acc[type][userId], current];
      }
    }

    return acc;
  }, {} as { [type: string]: { [userId: string]: DataEntity[] } });
};

export const findGroupDataByPeriodWithDataType: (
  client: DynamoDB.DocumentClient,
  params: {
    userId: string;
    groupId: string;
    dataType: string;
    from?: string;
    to?: string;
    timezone?: string;
  }
) => Promise<{ [userId: string]: DataEntity[] }> = async (
  client,
  { userId, groupId, dataType, from, to, timezone }
) => {
  const group = await getGroup(client, { userId, groupId });

  if (!group) {
    throw new NonExistentError();
  }

  if (!isConsumer(group, userId)) {
    throw new PermissionError();
  }

  const now = dayjs();

  const f = from
    ? toDateISOString(from, { timezone })
    : toDateISOString(now.subtract(7, 'day').format('YYYY-MM-DD'));
  const t = to
    ? toDateISOString(to, { timezone, isEndOf: true })
    : toDateISOString(now.format('YYYY-MM-DD'), { timezone, isEndOf: true });

  const records = await queryGroupDataRecordsByPeriodWithDataType(client, {
    groupId,
    dataType,
    from: f,
    to: t,
  });

  const data = records.map((record) => toEntity(record));

  return data.reduce((acc, current) => {
    const userId = current.user_id;

    if (!acc[userId]) {
      acc[userId] = [current];
    } else {
      acc[userId] = [...acc[userId], current];
    }

    return acc;
  }, {} as { [userId: string]: DataEntity[] });
};

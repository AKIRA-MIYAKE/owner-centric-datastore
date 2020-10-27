import { DynamoDBStreamHandler } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';
import dayjs from 'dayjs';

import { Record } from '../../interfaces';

import { isDataRecord, queryDataRecordsByPeriod } from '../../dynamodb/data';
import {
  isMemberRecord,
  queryMemberRecordsByUserIdWithRole,
} from '../../dynamodb/member';
import {
  queryGroupDataRecordsByUserId,
  batchPutGroupRecordsByDataRecordsAndGroupIds,
  batchDeleteGroupRecordsByDataRecordsAndGroupIds,
  batchDeleteGroupRecordsByGroupDataRecords,
} from '../../dynamodb/group-data';

export const handler: DynamoDBStreamHandler = async (event) => {
  return event.Records.reduce(async (acc, current) => {
    await acc;

    if (!current.dynamodb) {
      return;
    }

    const documentClient = new DynamoDB.DocumentClient();

    const newRecord =
      current.dynamodb.NewImage &&
      (DynamoDB.Converter.unmarshall(current.dynamodb.NewImage) as Record);
    const oldRecord =
      current.dynamodb.OldImage &&
      (DynamoDB.Converter.unmarshall(current.dynamodb.OldImage) as Record);

    switch (current.eventName) {
      case 'INSERT':
        if (!newRecord) {
          return;
        }

        if (isDataRecord(newRecord)) {
          const memberRecords = await queryMemberRecordsByUserIdWithRole(
            documentClient,
            {
              userId: newRecord.user_id,
              role: 'provider',
            }
          );

          const groupIds = memberRecords.map((record) => record.group_id);

          await batchPutGroupRecordsByDataRecordsAndGroupIds(documentClient, {
            dataRecords: [newRecord],
            groupIds,
          });
        } else if (isMemberRecord(newRecord)) {
          if (newRecord.role !== 'provider') {
            return;
          }

          const dataRecords = await queryDataRecordsByPeriod(documentClient, {
            userId: newRecord.user_id,
            from: dayjs('1970-01-01').toISOString(),
            to: dayjs().toISOString(),
          });

          if (dataRecords.length === 0) {
            return;
          }

          await batchPutGroupRecordsByDataRecordsAndGroupIds(documentClient, {
            dataRecords,
            groupIds: [newRecord.group_id],
          });
        }
        break;
      case 'MODIFY':
        if (!newRecord) {
          return;
        }

        if (isDataRecord(newRecord)) {
          const memberRecords = await queryMemberRecordsByUserIdWithRole(
            documentClient,
            {
              userId: newRecord.user_id,
              role: 'provider',
            }
          );

          const groupIds = memberRecords.map((record) => record.group_id);

          await batchPutGroupRecordsByDataRecordsAndGroupIds(documentClient, {
            dataRecords: [newRecord],
            groupIds,
          });
        }
        break;
      case 'REMOVE':
        if (!oldRecord) {
          return;
        }

        if (isDataRecord(oldRecord)) {
          const memberRecords = await queryMemberRecordsByUserIdWithRole(
            documentClient,
            {
              userId: oldRecord.user_id,
              role: 'provider',
            }
          );

          const groupIds = memberRecords.map((record) => record.group_id);

          await batchDeleteGroupRecordsByDataRecordsAndGroupIds(
            documentClient,
            {
              dataRecords: [oldRecord],
              groupIds,
            }
          );
        } else if (isMemberRecord(oldRecord)) {
          if (oldRecord.role !== 'provider') {
            return;
          }

          const groupDataRecords = await queryGroupDataRecordsByUserId(
            documentClient,
            {
              groupId: oldRecord.group_id,
              userId: oldRecord.user_id,
            }
          );

          if (groupDataRecords.length === 0) {
            return;
          }

          await batchDeleteGroupRecordsByGroupDataRecords(documentClient, {
            groupDataRecords,
          });
        }
        break;
    }
  }, Promise.resolve());
};

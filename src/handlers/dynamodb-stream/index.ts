import { DynamoDBStreamHandler } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';

import { Record } from '../../interfaces';

import { isDataRecord } from '../../dynamodb/data';
import { queryMemberRecordsByUserIdWithRole } from '../../dynamodb/member';
import { putGroupDataRecord } from '../../dynamodb/group-data';

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

          await memberRecords.reduce(async (acc, current) => {
            await acc;

            await putGroupDataRecord(documentClient, {
              dataRecord: newRecord,
              groupId: current.group_id,
            });
          }, Promise.resolve());
        }
        break;
      case 'MODIFY':
        break;
      case 'REMOVE':
        if (!oldRecord) {
          return;
        }

        break;
    }
  }, Promise.resolve());
};

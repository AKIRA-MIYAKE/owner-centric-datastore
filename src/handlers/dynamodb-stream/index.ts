import { DynamoDBStreamHandler } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';

import { Record } from '../../interfaces';

import {
  isDataRecord,
  getUserIdFromDataRecord,
  createGroupData,
} from '../../entities/data';
import { findGroupUserByUserIdWithRole } from '../../entities/group';

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
          const userId = getUserIdFromDataRecord(newRecord);
          const groupUsers = await findGroupUserByUserIdWithRole(
            documentClient,
            {
              userId,
              role: 'provider',
            }
          );

          await groupUsers.reduce(async (acc, current) => {
            await acc;

            await createGroupData(documentClient, {
              dataRecord: newRecord,
              groupId: current.group_id,
            });

            return Promise.resolve();
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

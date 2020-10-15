import { DynamoDB } from 'aws-sdk';

import { MemberEntity, MemberRole } from '../../interfaces';

import {
  toEntity,
  queryMemberRecordsByUserId,
  queryMemberRecordsByUserIdWithRole,
} from '../../dynamodb/member';

export const findMembersByUserId: (
  client: DynamoDB.DocumentClient,
  params: { userId: string }
) => Promise<MemberEntity[]> = async (client, { userId }) => {
  const records = await queryMemberRecordsByUserId(client, { userId });

  return records.map((record) => toEntity(record));
};

export const findMembersByUserIdWithRole: (
  client: DynamoDB.DocumentClient,
  params: { userId: string; role: MemberRole }
) => Promise<MemberEntity[]> = async (client, { userId, role }) => {
  const records = await queryMemberRecordsByUserIdWithRole(client, {
    userId,
    role,
  });

  return records.map((record) => toEntity(record));
};

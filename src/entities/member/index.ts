import { DynamoDB } from 'aws-sdk';

import { MemberEntity, MemberRole } from '../../interfaces';

import {
  ApplicationError,
  PermissionError,
  NonExistentError,
} from '../../lib/error';

import {
  toEntity,
  queryMemberRecordsByUserId,
  queryMemberRecordsByUserIdWithRole,
  deleteMemberRecord,
} from '../../dynamodb/member';

import { isOwner, getGroup } from '../group';

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

export const deleteMember: (
  client: DynamoDB.DocumentClient,
  params: { userId: string; groupId: string; memberId: string }
) => Promise<void> = async (client, { userId, groupId, memberId }) => {
  const group = await getGroup(client, { userId, groupId });

  if (!group) {
    throw new NonExistentError();
  }

  if (!isOwner(group, userId)) {
    throw new PermissionError();
  }

  if (group.owners.length === 1 && group.owners[0].id === memberId) {
    throw new ApplicationError('Group always needs an owner');
  }

  await deleteMemberRecord(client, {
    groupId,
    memberId,
  });
};

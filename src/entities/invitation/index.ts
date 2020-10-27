import { DynamoDB } from 'aws-sdk';

import {
  InvitationEntity,
  InvitationStatus,
  MemberRole,
} from '../../interfaces';

import {
  ApplicationError,
  PermissionError,
  NonExistentError,
} from '../../lib/error';

import {
  toEntity,
  getInvitationRecord,
  putInvitationRecord,
  queryInvitationRecordsByGroupId,
  queryInvitationRecordsByGroupIdWithStatus,
  queryInvitationRecordsByUserId,
  queryInvitationRecordsByUserIdWithStatus,
  updateInvitationRecordWithAcceptStatusAndCreateMemberRecord,
  updateInvitationRecordWithDeclienStatus,
} from '../../dynamodb/invitation';

import { getUser } from '../user';
import { isOwner, isProvider, isConsumer, getGroup } from '../group';

export const findInvitationsByGroupId: (
  client: DynamoDB.DocumentClient,
  params: { userId: string; groupId: string }
) => Promise<InvitationEntity[]> = async (client, { userId, groupId }) => {
  const group = await getGroup(client, { userId, groupId });

  if (!group) {
    throw new NonExistentError();
  }

  if (!isOwner(group, userId)) {
    throw new PermissionError();
  }

  const records = await queryInvitationRecordsByGroupId(client, { groupId });

  return records.map((record) => toEntity(record));
};

export const findInvitationsByGroupIdWithStatus: (
  client: DynamoDB.DocumentClient,
  params: { userId: string; groupId: string; status: InvitationStatus }
) => Promise<InvitationEntity[]> = async (
  client,
  { userId, groupId, status }
) => {
  const group = await getGroup(client, { userId, groupId });

  if (!group) {
    throw new NonExistentError();
  }

  if (!isOwner(group, userId)) {
    throw new PermissionError();
  }

  const records = await queryInvitationRecordsByGroupIdWithStatus(client, {
    groupId,
    status,
  });

  return records.map((record) => toEntity(record));
};

export const findInvitationsByUserId: (
  client: DynamoDB.DocumentClient,
  params: { userId: string }
) => Promise<InvitationEntity[]> = async (client, { userId }) => {
  const records = await queryInvitationRecordsByUserId(client, { userId });

  return records.map((record) => toEntity(record));
};

export const findInvitationsByUserIdWithStatus: (
  client: DynamoDB.DocumentClient,
  params: { userId: string; status: InvitationStatus }
) => Promise<InvitationEntity[]> = async (client, { userId, status }) => {
  const records = await queryInvitationRecordsByUserIdWithStatus(client, {
    userId,
    status,
  });

  return records.map((record) => toEntity(record));
};

export const createInvitation: (
  client: DynamoDB.DocumentClient,
  params: {
    userId: string;
    groupId: string;
    invitingUserId: string;
    role: MemberRole;
  }
) => Promise<InvitationEntity | undefined> = async (
  client,
  { userId, groupId, invitingUserId, role }
) => {
  const group = await getGroup(client, { userId, groupId });

  if (!group) {
    throw new NonExistentError();
  }

  if (!isOwner(group, userId)) {
    throw new PermissionError();
  }

  const invitingUser = await getUser(client, { userId: invitingUserId });

  if (!invitingUser) {
    throw new ApplicationError('Inviting user is not registered');
  }

  switch (role) {
    case 'owner':
      if (isOwner(group, invitingUser.id)) {
        throw new ApplicationError(
          'The user already belongs to the group as the owner'
        );
      }
      break;
    case 'provider':
      if (isProvider(group, invitingUser.id)) {
        throw new ApplicationError(
          'The user already belongs to the group as the provider'
        );
      }
      break;
    case 'consumer':
      if (isConsumer(group, invitingUser.id)) {
        throw new ApplicationError(
          'The user already belongs to the group as the consumer'
        );
      }
      break;
  }

  const currentInvitations = await findInvitationsByGroupIdWithStatus(client, {
    userId,
    groupId,
    status: 'pending',
  });

  if (
    currentInvitations.some(
      (i) => i.user_id === invitingUser.id && i.role === role
    )
  ) {
    throw new ApplicationError('The user has already been invited');
  }

  const record = await putInvitationRecord(client, {
    groupId,
    groupName: group.name,
    userId: invitingUser.id,
    userNickname: invitingUser.nickname,
    memberRole: role,
  });

  return toEntity(record);
};

export const acceptInvitation: (
  client: DynamoDB.DocumentClient,
  params: { userId: string; groupId: string; invitationId: string }
) => Promise<InvitationEntity> = async (
  client,
  { userId, groupId, invitationId }
) => {
  const record = await getInvitationRecord(client, {
    groupId,
    invitationId,
  });

  const invitation = record && toEntity(record);

  if (!invitation) {
    throw new NonExistentError();
  }

  if (invitation.user_id !== userId) {
    throw new PermissionError();
  }

  const [
    updated,
  ] = await updateInvitationRecordWithAcceptStatusAndCreateMemberRecord(
    client,
    {
      groupId: invitation.group_id,
      invitationId: invitation.id,
      groupName: invitation.group_name,
      userId: invitation.user_id,
      userNickname: invitation.user_nickname,
      memberRole: invitation.role,
    }
  );

  return {
    ...invitation,
    ...updated,
  };
};

export const declineInvitation: (
  client: DynamoDB.DocumentClient,
  params: { userId: string; groupId: string; invitationId: string }
) => Promise<InvitationEntity> = async (
  client,
  { userId, groupId, invitationId }
) => {
  const record = await getInvitationRecord(client, {
    groupId,
    invitationId,
  });

  const invitation = record && toEntity(record);

  if (!invitation) {
    throw new NonExistentError();
  }

  if (invitation.user_id !== userId) {
    throw new PermissionError();
  }

  const updated = await updateInvitationRecordWithDeclienStatus(client, {
    groupId: invitation.group_name,
    invitationId: invitation.id,
  });

  return {
    ...invitation,
    ...updated,
  };
};

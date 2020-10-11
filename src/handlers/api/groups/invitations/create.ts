import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';

import {
  generateCORSHeaders,
  getAccessTokenPayload,
  parseJSONBody,
  generateUnauthorizedProxyResult,
  generateBadRequestProxyResult,
  generateNotFoundProxyResult,
  generateDefaultErrorProxyResult,
} from '../../../../lib/api';

import { isGroupUserRole } from '../../../../interfaces';

import { getUser } from '../../../../entities/user';
import {
  isGroupUser,
  isOwner,
  isProvider,
  isConsumer,
  getGroup,
} from '../../../../entities/group';
import {
  createInvitation,
  findInvitationByGroupId,
} from '../../../../entities/invitation';

export const handler: APIGatewayProxyHandler = async (event) => {
  const corsHeaders = generateCORSHeaders();

  try {
    const tokenPayload = getAccessTokenPayload(event.requestContext.authorizer);

    if (!tokenPayload) {
      return generateUnauthorizedProxyResult({ headers: corsHeaders });
    }

    const groupId = event.pathParameters && event.pathParameters['group_id'];

    if (!groupId) {
      return generateBadRequestProxyResult({ headers: corsHeaders });
    }

    const documentClient = new DynamoDB.DocumentClient();

    const group = await getGroup(documentClient, { id: groupId });

    if (!group) {
      return generateNotFoundProxyResult({ headers: corsHeaders });
    }

    const operatorId = tokenPayload.sub;

    if (!isGroupUser(group, operatorId)) {
      return generateNotFoundProxyResult({ headers: corsHeaders });
    }

    if (!isOwner(group, operatorId)) {
      return generateUnauthorizedProxyResult({
        headers: corsHeaders,
        message: 'This operation is not allowed',
      });
    }

    const requestBody = parseJSONBody(event.body);

    if (!requestBody) {
      return generateBadRequestProxyResult({ headers: corsHeaders });
    }

    const userId = requestBody['user_id'];
    const role = requestBody['role'];

    const errorMessages: string[] = [];

    if (typeof userId === 'undefined') {
      errorMessages.push('"user_id" is required');
    }

    if (typeof userId !== 'string') {
      errorMessages.push('"user_id" must be string');
    }

    if (typeof role === 'undefined') {
      errorMessages.push('"role" is required');
    }

    if (typeof role !== 'string') {
      errorMessages.push('"role" must be string');
    }

    if (!isGroupUserRole(role)) {
      errorMessages.push(
        '"role" is limited to "owner", "provider" and "consumer"'
      );
    } else {
      switch (role) {
        case 'owner':
          if (isOwner(group, userId)) {
            errorMessages.push('The user already belongs to this group');
          }
          break;
        case 'provider':
          if (isProvider(group, userId)) {
            errorMessages.push('The user already belongs to this group');
          }
          break;
        case 'consumer':
          if (isConsumer(group, userId)) {
            errorMessages.push('The user already belongs to this group');
          }
          break;
      }
    }

    if (errorMessages.length > 0) {
      return generateBadRequestProxyResult({
        headers: corsHeaders,
        message: errorMessages.join(' / '),
      });
    }

    const user = await getUser(documentClient, {
      id: requestBody['user_id'],
    });

    if (!user) {
      return generateBadRequestProxyResult({
        headers: corsHeaders,
        message: 'The user does not exist',
      });
    }

    const currentInvitations = await findInvitationByGroupId(documentClient, {
      groupId: group.id,
    });

    const exists = currentInvitations.some((ci) => {
      return (
        ci.user_id === user.id && ci.role === role && ci.status === 'pending'
      );
    });

    if (exists) {
      return generateBadRequestProxyResult({
        headers: corsHeaders,
        message: 'The user has already been invited',
      });
    }

    const invitation = await createInvitation(documentClient, {
      group,
      user,
      role,
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(invitation),
    };
  } catch (error) {
    console.log(error);
    return generateDefaultErrorProxyResult({ headers: corsHeaders, error });
  }
};

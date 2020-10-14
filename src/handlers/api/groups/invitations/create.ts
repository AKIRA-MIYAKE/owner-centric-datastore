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

import { isMemberRole, MemberRole } from '../../../../interfaces';

import { getUser } from '../../../../entities/user';
import {
  isMember,
  isOwner,
  isProvider,
  isConsumer,
  getGroup,
} from '../../../../entities/group';
import {
  createInvitation,
  findInvitationByGroupIdWithStatus,
} from '../../../../entities/invitation';

export type RequestBody =  { [key: string]: any } & {  // eslint-disable-line
  user_id: string;
  role: MemberRole;
};

export function isValidRequestBody(
  requestBody: { [key: string]: any } // eslint-disable-line
): asserts requestBody is RequestBody {
  const errorMessages: string[] = [];

  if (typeof requestBody['user_id'] === 'undefined') {
    errorMessages.push('"user_id" is required');
  }

  if (typeof requestBody['user_id'] !== 'string') {
    errorMessages.push('"user_id" must be string');
  }

  if (typeof requestBody['role'] === 'undefined') {
    errorMessages.push('"role" is required');
  }

  if (typeof requestBody['role'] !== 'string') {
    errorMessages.push('"role" must be string');
  }

  if (!isMemberRole(requestBody['role'])) {
    errorMessages.push(
      '"role" is limited to "owner", "provider" and "consumer"'
    );
  }

  if (errorMessages.length > 0) {
    throw new Error(errorMessages.join(' / '));
  }
}

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

    if (!isMember(group, operatorId)) {
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

    try {
      isValidRequestBody(requestBody);
    } catch (error) {
      return generateBadRequestProxyResult({
        headers: corsHeaders,
        message: error.message,
      });
    }

    switch (requestBody.role) {
      case 'owner':
        if (isOwner(group, requestBody.user_id)) {
          return generateBadRequestProxyResult({
            headers: corsHeaders,
            message: 'The user already belongs to this group',
          });
        }
        break;
      case 'provider':
        if (isProvider(group, requestBody.user_id)) {
          return generateBadRequestProxyResult({
            headers: corsHeaders,
            message: 'The user already belongs to this group',
          });
        }
        break;
      case 'consumer':
        if (isConsumer(group, requestBody.user_id)) {
          return generateBadRequestProxyResult({
            headers: corsHeaders,
            message: 'The user already belongs to this group',
          });
        }
        break;
    }

    const user = await getUser(documentClient, {
      id: requestBody.user_id,
    });

    if (!user) {
      return generateBadRequestProxyResult({
        headers: corsHeaders,
        message: 'The user does not exist',
      });
    }

    const currentInvitations = await findInvitationByGroupIdWithStatus(
      documentClient,
      {
        groupId: group.id,
        status: 'pending',
      }
    );

    const exists = currentInvitations.some((ci) => {
      return ci.user_id === user.id && ci.role === requestBody.role;
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
      role: requestBody.role,
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

import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';

import {
  generateCORSHeaders,
  getUserId,
  parseJSONBody,
  handleApplicationError,
  generateUnauthorizedProxyResult,
  generateBadRequestProxyResult,
  generateDefaultErrorProxyResult,
} from '../../../../lib/api';

import { isMemberRole, MemberRole } from '../../../../interfaces';

import { createInvitation } from '../../../../entities/invitation';

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
    const userId = getUserId(event.requestContext.authorizer);

    if (!userId) {
      return generateUnauthorizedProxyResult({ headers: corsHeaders });
    }

    const groupId = event.pathParameters && event.pathParameters['group_id'];

    if (!groupId) {
      return generateBadRequestProxyResult({ headers: corsHeaders });
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

    try {
      const documentClient = new DynamoDB.DocumentClient();

      const invitation = await createInvitation(documentClient, {
        userId,
        groupId,
        invitingUserId: requestBody.user_id,
        role: requestBody.role,
      });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(invitation),
      };
    } catch (error) {
      return handleApplicationError({
        headers: corsHeaders,
        error,
      });
    }
  } catch (error) {
    console.log(error);
    return generateDefaultErrorProxyResult({ headers: corsHeaders, error });
  }
};

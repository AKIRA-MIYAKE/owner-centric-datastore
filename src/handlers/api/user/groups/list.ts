import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';

import { isGroupUserRole, GroupUser } from '../../../../interfaces';

import {
  generateCORSHeaders,
  getAccessTokenPayload,
  getQueryStringParameters,
  generateUnauthorizedProxyResult,
  generateBadRequestProxyResult,
  generateDefaultErrorProxyResult,
} from '../../../../lib/api';

import {
  findGroupUserByUserId,
  findGroupUserByUserIdWithRole,
} from '../../../../entities/group';

export const handler: APIGatewayProxyHandler = async (event) => {
  const corsHeaders = generateCORSHeaders();

  try {
    const tokenPayload = getAccessTokenPayload(event.requestContext.authorizer);

    if (!tokenPayload) {
      return generateUnauthorizedProxyResult({ headers: corsHeaders });
    }

    const documentClient = new DynamoDB.DocumentClient();

    const queryStrings = getQueryStringParameters(event.queryStringParameters);

    const role = queryStrings && queryStrings['role'];

    let groupUsers: GroupUser[];
    if (!role) {
      groupUsers = await findGroupUserByUserId(documentClient, {
        userId: tokenPayload.sub,
      });
    } else {
      if (!isGroupUserRole(role)) {
        return generateBadRequestProxyResult({
          headers: corsHeaders,
          message: '"role" is limited to "owner", "provider" and "consumer"',
        });
      }

      groupUsers = await findGroupUserByUserIdWithRole(documentClient, {
        userId: tokenPayload.sub,
        role: role,
      });
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(groupUsers),
    };
  } catch (error) {
    console.log(error);
    return generateDefaultErrorProxyResult({ headers: corsHeaders, error });
  }
};

import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';

import { InvitationEntity, isInvitationStatus } from '../../../../interfaces';

import {
  generateCORSHeaders,
  getAccessTokenPayload,
  getQueryStringParameters,
  generateUnauthorizedProxyResult,
  generateBadRequestProxyResult,
  generateDefaultErrorProxyResult,
} from '../../../../lib/api';

import {
  findInvitationByUserId,
  findInvitationByUserIdWithStatus,
} from '../../../../entities/invitation';

export const handler: APIGatewayProxyHandler = async (event) => {
  const corsHeaders = generateCORSHeaders();

  try {
    const tokenPayload = getAccessTokenPayload(event.requestContext.authorizer);

    if (!tokenPayload) {
      return generateUnauthorizedProxyResult({ headers: corsHeaders });
    }

    const userId = tokenPayload.sub;

    const documentClient = new DynamoDB.DocumentClient();

    const queryStrings = getQueryStringParameters(event.queryStringParameters);

    const status = queryStrings && queryStrings['status'];

    let invitations: InvitationEntity[];

    if (!status) {
      invitations = await findInvitationByUserId(documentClient, {
        userId,
      });
    } else {
      if (!isInvitationStatus(status)) {
        return generateBadRequestProxyResult({
          headers: corsHeaders,
          message: '"status" is limited to "pending", "accept" and "decline"',
        });
      }

      invitations = await findInvitationByUserIdWithStatus(documentClient, {
        userId,
        status,
      });
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(invitations),
    };
  } catch (error) {
    console.log(error);
    return generateDefaultErrorProxyResult({ headers: corsHeaders, error });
  }
};

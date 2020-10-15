import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';

import {
  generateCORSHeaders,
  getUserId,
  handleApplicationError,
  generateUnauthorizedProxyResult,
  generateBadRequestProxyResult,
  generateDefaultErrorProxyResult,
} from '../../../../lib/api';

import { declineInvitation } from '../../../../entities/invitation';

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

    const invitationId =
      event.pathParameters && event.pathParameters['invitation_id'];

    if (!invitationId) {
      return generateBadRequestProxyResult({ headers: corsHeaders });
    }

    try {
      const documentClient = new DynamoDB.DocumentClient();

      const invitation = await declineInvitation(documentClient, {
        userId,
        groupId,
        invitationId,
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

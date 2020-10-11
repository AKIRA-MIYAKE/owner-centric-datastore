import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';

import {
  generateCORSHeaders,
  getAccessTokenPayload,
  generateUnauthorizedProxyResult,
  generateBadRequestProxyResult,
  generateNotFoundProxyResult,
  generateDefaultErrorProxyResult,
} from '../../../../lib/api';

import {
  getInvitation,
  acceptInvitation,
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

    const invitationId =
      event.pathParameters && event.pathParameters['invitation_id'];

    if (!invitationId) {
      return generateBadRequestProxyResult({ headers: corsHeaders });
    }

    const documentClient = new DynamoDB.DocumentClient();

    const invitation = await getInvitation(documentClient, {
      id: invitationId,
      groupId,
    });

    if (!invitation) {
      return generateNotFoundProxyResult({ headers: corsHeaders });
    }

    const userId = tokenPayload.sub;

    if (invitation.user_id !== userId) {
      return generateNotFoundProxyResult({ headers: corsHeaders });
    }

    const updatedInvitation = await acceptInvitation(documentClient, {
      invitation,
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(updatedInvitation),
    };
  } catch (error) {
    console.log(error);
    return generateDefaultErrorProxyResult({ headers: corsHeaders, error });
  }
};

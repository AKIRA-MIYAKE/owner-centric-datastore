import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';

import { InvitationEntity, isInvitationStatus } from '../../../../interfaces';

import {
  generateCORSHeaders,
  getAccessTokenPayload,
  getQueryStringParameters,
  generateUnauthorizedProxyResult,
  generateBadRequestProxyResult,
  generateNotFoundProxyResult,
  generateDefaultErrorProxyResult,
} from '../../../../lib/api';

import { isGroupUser, isOwner, getGroup } from '../../../../entities/group';
import {
  findInvitationByGroupId,
  findInvitationByGroupIdWithStatus,
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

    const userId = tokenPayload.sub;

    if (!isGroupUser(group, userId)) {
      return generateNotFoundProxyResult({ headers: corsHeaders });
    }

    if (!isOwner(group, userId)) {
      return generateUnauthorizedProxyResult({
        headers: corsHeaders,
        message: 'This operation is not allowed',
      });
    }

    const queryStrings = getQueryStringParameters(event.queryStringParameters);

    const status = queryStrings && queryStrings['status'];

    let invitations: InvitationEntity[];
    if (!status) {
      invitations = await findInvitationByGroupId(documentClient, {
        groupId,
      });
    } else {
      if (!isInvitationStatus(status)) {
        return generateBadRequestProxyResult({
          headers: corsHeaders,
          message: '"status" is limited to "pending", "accept" and "decline"',
        });
      }

      invitations = await findInvitationByGroupIdWithStatus(documentClient, {
        groupId,
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

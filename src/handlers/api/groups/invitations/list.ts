import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';

import {
  isInvitationStatus,
  InvitationEntity,
  InvitationStatus,
} from '../../../../interfaces';

import {
  generateCORSHeaders,
  getUserId,
  getQueryStringParameters,
  handleApplicationError,
  generateUnauthorizedProxyResult,
  generateBadRequestProxyResult,
  generateDefaultErrorProxyResult,
} from '../../../../lib/api';

import {
  findInvitationsByGroupId,
  findInvitationsByGroupIdWithStatus,
} from '../../../../entities/invitation';

export type QueryStrings = { [key: string]: string } & {
  status?: InvitationStatus;
};

export function isValidQueryStrings(queryStrings: {
  [key: string]: string;
}): asserts queryStrings is QueryStrings {
  if (typeof queryStrings['status'] !== 'undefined') {
    if (!isInvitationStatus(queryStrings['status'])) {
      throw new Error(
        '"status" is limited to "pending", "accept" and "decline"'
      );
    }
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

    const queryStrings = getQueryStringParameters(event.queryStringParameters);

    let status: InvitationStatus | undefined;

    if (queryStrings) {
      try {
        isValidQueryStrings(queryStrings);

        status = queryStrings.status;
      } catch (error) {
        return generateBadRequestProxyResult({
          headers: corsHeaders,
          message: error.message,
        });
      }
    }

    try {
      const documentClient = new DynamoDB.DocumentClient();

      let invitations: InvitationEntity[] | undefined;
      if (!status) {
        invitations = await findInvitationsByGroupId(documentClient, {
          userId,
          groupId,
        });
      } else {
        invitations = await findInvitationsByGroupIdWithStatus(documentClient, {
          userId,
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

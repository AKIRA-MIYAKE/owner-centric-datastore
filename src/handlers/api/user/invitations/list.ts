import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';

import {
  InvitationEntity,
  InvitationStatus,
  isInvitationStatus,
} from '../../../../interfaces';

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
    const tokenPayload = getAccessTokenPayload(event.requestContext.authorizer);

    if (!tokenPayload) {
      return generateUnauthorizedProxyResult({ headers: corsHeaders });
    }

    const userId = tokenPayload.sub;

    const documentClient = new DynamoDB.DocumentClient();

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

    let invitations: InvitationEntity[];
    if (!status) {
      invitations = await findInvitationByUserId(documentClient, {
        userId,
      });
    } else {
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

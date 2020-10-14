import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';

import { isMemberRole, MemberEntity, MemberRole } from '../../../../interfaces';

import {
  generateCORSHeaders,
  getAccessTokenPayload,
  getQueryStringParameters,
  generateUnauthorizedProxyResult,
  generateBadRequestProxyResult,
  generateDefaultErrorProxyResult,
} from '../../../../lib/api';

import {
  findMemberByUserId,
  findMemberByUserIdWithRole,
} from '../../../../entities/group';

export type QueryStrings = { [key: string]: string } & {
  role?: MemberRole;
};

export function isValidQueryStrings(queryStrings: {
  [key: string]: string;
}): asserts queryStrings is QueryStrings {
  if (typeof queryStrings['role'] !== 'undefined') {
    if (!isMemberRole(queryStrings['role'])) {
      throw new Error(
        '"role" is limited to "owner", "provider" and "consumer"'
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

    const documentClient = new DynamoDB.DocumentClient();

    const queryStrings = getQueryStringParameters(event.queryStringParameters);

    let role: MemberRole | undefined;

    if (queryStrings) {
      try {
        isValidQueryStrings(queryStrings);

        role = queryStrings.role;
      } catch (error) {
        return generateBadRequestProxyResult({
          headers: corsHeaders,
          message: error.message,
        });
      }
    }

    let Members: MemberEntity[];
    if (!role) {
      Members = await findMemberByUserId(documentClient, {
        userId: tokenPayload.sub,
      });
    } else {
      Members = await findMemberByUserIdWithRole(documentClient, {
        userId: tokenPayload.sub,
        role: role,
      });
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(Members),
    };
  } catch (error) {
    console.log(error);
    return generateDefaultErrorProxyResult({ headers: corsHeaders, error });
  }
};

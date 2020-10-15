import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';

import { isMemberRole, MemberEntity, MemberRole } from '../../../../interfaces';

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
  findMembersByUserId,
  findMembersByUserIdWithRole,
} from '../../../../entities/member';

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
    const userId = getUserId(event.requestContext.authorizer);

    if (!userId) {
      return generateUnauthorizedProxyResult({ headers: corsHeaders });
    }

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

    try {
      const documentClient = new DynamoDB.DocumentClient();

      let members: MemberEntity[];
      if (!role) {
        members = await findMembersByUserId(documentClient, {
          userId,
        });
      } else {
        members = await findMembersByUserIdWithRole(documentClient, {
          userId,
          role,
        });
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(members),
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

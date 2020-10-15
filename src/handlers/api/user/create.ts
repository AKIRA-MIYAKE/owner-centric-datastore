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
} from '../../../lib/api';

import { createUser } from '../../../entities/user';

export type RequestBody =  { [key: string]: any } & {  // eslint-disable-line
  nickname: string;
};

export function isValidRequestBody(
  requestBody: { [key: string]: any } // eslint-disable-line
): asserts requestBody is RequestBody {
  const errorMessages: string[] = [];

  if (typeof requestBody['nickname'] === 'undefined') {
    errorMessages.push('"nickname" is required');
  }

  if (typeof requestBody['nickname'] !== 'string') {
    errorMessages.push('"nickname" must be string');
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

      const user = await createUser(documentClient, {
        userId,
        nickname: requestBody.nickname,
      });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(user),
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

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

import { createGroup } from '../../../entities/group';

export type RequestBody =  { [key: string]: any } & {  // eslint-disable-line
  name: string;
};

export function isValidRequestBody(
  requestBody: { [key: string]: any } // eslint-disable-line
): asserts requestBody is RequestBody {
  const errorMessages: string[] = [];

  if (typeof requestBody['name'] === 'undefined') {
    errorMessages.push('"name" is required');
  }

  if (typeof requestBody['name'] !== 'string') {
    errorMessages.push('"name" must be string');
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

      const group = await createGroup(documentClient, {
        userId,
        name: requestBody.name,
      });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(group),
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

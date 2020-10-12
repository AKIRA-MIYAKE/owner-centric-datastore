import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';

import {
  generateCORSHeaders,
  getAccessTokenPayload,
  parseJSONBody,
  generateUnauthorizedProxyResult,
  generateBadRequestProxyResult,
  generateDefaultErrorProxyResult,
} from '../../../lib/api';

import { getUser } from '../../../entities/user';
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
    const tokenPayload = getAccessTokenPayload(event.requestContext.authorizer);

    if (!tokenPayload) {
      return generateUnauthorizedProxyResult({ headers: corsHeaders });
    }

    const documentClient = new DynamoDB.DocumentClient();

    const user = await getUser(documentClient, { id: tokenPayload.sub });

    if (!user) {
      return generateBadRequestProxyResult({
        headers: corsHeaders,
        message: 'User registration required',
      });
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

    const group = await createGroup(documentClient, {
      user,
      name: requestBody.name,
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(group),
    };
  } catch (error) {
    console.log(error);
    return generateDefaultErrorProxyResult({ headers: corsHeaders, error });
  }
};

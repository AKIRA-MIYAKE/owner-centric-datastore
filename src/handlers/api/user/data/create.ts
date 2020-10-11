import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';

import { isDataPayload } from '../../../../interfaces';

import {
  generateCORSHeaders,
  getAccessTokenPayload,
  parseJSONBody,
  getQueryStringParameters,
  generateUnauthorizedProxyResult,
  generateBadRequestProxyResult,
  generateDefaultErrorProxyResult,
} from '../../../../lib/api';
import { validateTimezone } from '../../../../lib/date';

import { validateDataPayload, createData } from '../../../../entities/data';

export const handler: APIGatewayProxyHandler = async (event) => {
  const corsHeaders = generateCORSHeaders();

  try {
    const tokenPayload = getAccessTokenPayload(event.requestContext.authorizer);

    if (!tokenPayload) {
      return generateUnauthorizedProxyResult({ headers: corsHeaders });
    }

    const requestBody = parseJSONBody(event.body);

    if (!requestBody) {
      return generateBadRequestProxyResult({ headers: corsHeaders });
    }

    try {
      isDataPayload(requestBody);
    } catch (error) {
      return generateBadRequestProxyResult({
        headers: corsHeaders,
        message: error.message,
      });
    }

    const errorMessages: string[] = [];

    errorMessages.push(...validateDataPayload(requestBody));

    const queryStrings = getQueryStringParameters(event.queryStringParameters);

    const timezone = queryStrings && queryStrings['timezone'];

    if (timezone) {
      errorMessages.push(...validateTimezone(timezone));
    }

    if (errorMessages.length > 0) {
      return generateBadRequestProxyResult({
        headers: corsHeaders,
        message: errorMessages.join(' / '),
      });
    }

    const documentClient = new DynamoDB.DocumentClient();

    const data = await createData(documentClient, {
      userId: tokenPayload.sub,
      payload: requestBody,
      timezone,
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.log(error);
    return generateDefaultErrorProxyResult({ headers: corsHeaders, error });
  }
};

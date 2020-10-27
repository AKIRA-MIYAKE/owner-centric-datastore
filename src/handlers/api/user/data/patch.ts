import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';

import { DataPayload, isDataPayload } from '../../../../interfaces';

import {
  generateCORSHeaders,
  getUserId,
  parseJSONBody,
  getQueryStringParameters,
  handleApplicationError,
  generateUnauthorizedProxyResult,
  generateBadRequestProxyResult,
  generateDefaultErrorProxyResult,
} from '../../../../lib/api';
import { validateTimezone } from '../../../../lib/date';

import { validateDataPayload, patchData } from '../../../../entities/data';

export const isValidDataPayload: (dataPayload: DataPayload) => void = (
  dataPayload
) => {
  const errorMessages = validateDataPayload(dataPayload);

  if (errorMessages.length > 0) {
    throw new Error(errorMessages.join(' / '));
  }
};

export type QueryStrings = { [key: string]: string } & {
  timezone?: string;
};

export function isValidQueryStrings(queryStrings: {
  [key: string]: string;
}): asserts queryStrings is QueryStrings {
  const errorMessages: string[] = [];

  if (typeof queryStrings['timezone'] !== 'undefined') {
    errorMessages.push(...validateTimezone(queryStrings['timezone']));
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

    const dataId = event.pathParameters && event.pathParameters['data_id'];

    if (!dataId) {
      return generateBadRequestProxyResult({ headers: corsHeaders });
    }

    const requestBody = parseJSONBody(event.body);

    if (!requestBody) {
      return generateBadRequestProxyResult({ headers: corsHeaders });
    }

    try {
      isDataPayload(requestBody);
      isValidDataPayload(requestBody);
    } catch (error) {
      return generateBadRequestProxyResult({
        headers: corsHeaders,
        message: error.message,
      });
    }

    const queryStrings = getQueryStringParameters(event.queryStringParameters);

    let timezone: string | undefined;

    if (queryStrings) {
      try {
        isValidQueryStrings(queryStrings);

        timezone = queryStrings.timezone;
      } catch (error) {
        return generateBadRequestProxyResult({
          headers: corsHeaders,
          message: error.message,
        });
      }
    }

    try {
      const documentClient = new DynamoDB.DocumentClient();

      const data = await patchData(documentClient, {
        userId,
        dataId,
        payload: requestBody,
        timezone,
      });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(data),
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

import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';
import dayjs from 'dayjs';

import {
  generateCORSHeaders,
  getAccessTokenPayload,
  getQueryStringParameters,
  generateUnauthorizedProxyResult,
  generateBadRequestProxyResult,
  generateNotFoundProxyResult,
  generateDefaultErrorProxyResult,
} from '../../../../lib/api';
import {
  toDateISOString,
  validateDate,
  validateTimezone,
} from '../../../../lib/date';

import { isGroupUser, isConsumer, getGroup } from '../../../../entities/group';
import { findGroupDataByPeriod } from '../../../../entities/data';

export type QueryStrings = { [key: string]: string } & {
  from?: string;
  to?: string;
  timezone?: string;
};

export function isValidQueryStrings(
  queryStrings: { [key: string]: string } // esint-disableli
): asserts queryStrings is QueryStrings {
  const errorMessages: string[] = [];

  if (typeof queryStrings['from'] !== 'undefined') {
    errorMessages.push(...validateDate(queryStrings['from']));
  }

  if (typeof queryStrings['to'] !== 'undefined') {
    errorMessages.push(...validateDate(queryStrings['to']));
  }

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

    if (!isConsumer(group, userId)) {
      return generateUnauthorizedProxyResult({
        headers: corsHeaders,
        message: 'This operation is not allowed',
      });
    }

    const queryStrings = getQueryStringParameters(event.queryStringParameters);

    let from: string | undefined;
    let to: string | undefined;
    let timezone: string | undefined;

    if (queryStrings) {
      try {
        isValidQueryStrings(queryStrings);

        from = queryStrings.from;
        to = queryStrings.to;
        timezone = queryStrings.timezone;
      } catch (error) {
        return generateBadRequestProxyResult({
          headers: corsHeaders,
          message: error.message,
        });
      }
    }

    const now = dayjs().startOf('day');

    const data = await findGroupDataByPeriod(documentClient, {
      groupId,
      from: from
        ? toDateISOString(from, { timezone })
        : toDateISOString(now.subtract(7, 'day').format('YYYY-MM-DD'), {
            timezone,
          }),
      to: to
        ? toDateISOString(to, { timezone, isEndOf: true })
        : toDateISOString(now.format('YYYY-MM-DD'), {
            timezone,
            isEndOf: true,
          }),
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

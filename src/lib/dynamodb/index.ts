import { DynamoDB } from 'aws-sdk';

export const queryAll: (
  client: DynamoDB.DocumentClient,
  params: DynamoDB.DocumentClient.QueryInput,
  items?: DynamoDB.DocumentClient.ItemList
) => Promise<DynamoDB.DocumentClient.ItemList> = async (
  client,
  params,
  items = []
) => {
  const result = await client.query(params).promise();

  if (!result.Items) {
    return [...items];
  }

  const updatedItems = [...items, ...result.Items];

  if (typeof result.LastEvaluatedKey !== 'undefined') {
    return await queryAll(
      client,
      { ...params, ExclusiveStartKey: result.LastEvaluatedKey },
      updatedItems
    );
  } else {
    return updatedItems;
  }
};

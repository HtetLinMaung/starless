import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { hello } from "../../layers/common/utils";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: hello(),
    }),
  };
};

import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { hello } from "../../layers/common/utils";

const httpTrigger: AzureFunction = async function (
  context: Context,
  req: HttpRequest
): Promise<void> {
  context.log("HTTP trigger function processed a request.");
  context.res = {
    // status: 200, /* Defaults to 200 */
    body: {
      message: hello(),
    },
  };
};

export default httpTrigger;

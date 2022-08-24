import dotenv from "dotenv";
dotenv.config();

import express, { Request, Response } from "express";
import cors from "cors";
import template from "./template.json";
import { APIGatewayProxyResult } from "aws-lambda";
import chalk from "chalk";

const PORT = process.env.PORT || 7070;

const app = express();

app.use(cors());
app.use(express.json());

const prefix = "/api/";

app.listen(PORT, () => {
  (async () => {
    for (const [_, func] of Object.entries(template.functions)) {
      for (const method of func.methods) {
        const module = await import(`./${func.path}`);

        let expressHandler = null;
        if ("handler" in module) {
          const { handler } = module;
          expressHandler = async (req: Request, res: Response) => {
            const event = {
              path: req.path,
              httpMethod: method,
              headers: req.headers,
              queryStringParameters: req.query,
              pathParameters: req.params,
              body: JSON.stringify(req.body),
            };
            const lambdaResponse: APIGatewayProxyResult = await handler(event);
            if (lambdaResponse.hasOwnProperty("headers")) {
              for (const [k, v] of Object.entries(lambdaResponse.headers)) {
                res.setHeader(k, v.toString());
              }
            }
            res
              .status(lambdaResponse.statusCode)
              .send(JSON.parse(lambdaResponse.body));
          };
        } else {
          const handler = module.default;
          expressHandler = async (req: Request, res: Response) => {
            const context: any = {
              log: (msg: string) =>
                console.log(
                  `${chalk.gray(`[${new Date().toISOString()}]`)} ${chalk.cyan(
                    msg
                  )}`
                ),
              res: {
                status: 200,
                body: "",
              },
            };
            const event = {
              url: `http://localhost:${PORT}${req.path}`,
              method: req.method,
              headers: req.headers,
              query: req.query,
              params: req.params,
              body: req.body,
            };

            await handler(context, event);
            const { status, body, headers } = context.res;
            if (headers) {
              for (const [k, v] of Object.entries(headers)) {
                res.setHeader(k, v.toString());
              }
            }
            res.status(status || 200).send(body);
          };
        }

        switch (method) {
          case "GET":
            app.get(`${prefix}${func.route}`, expressHandler);
            break;
          case "POST":
            app.post(`${prefix}${func.route}`, expressHandler);
            break;
          case "PUT":
            app.put(`${prefix}${func.route}`, expressHandler);
            break;
          case "PATCH":
            app.patch(`${prefix}${func.route}`, expressHandler);
            break;
          case "DELETE":
            app.delete(`${prefix}${func.route}`, expressHandler);
            break;
          default:
            throw new Error(`Unsupported method: ${method}`);
        }
      }
    }

    for (const [name, func] of Object.entries(template.functions)) {
      console.log(
        chalk.yellow(`\n${name} `) +
          chalk.green(
            `[${func.methods.join(", ")}] http://localhost:${PORT}${prefix}${
              func.route
            }`
          )
      );
    }
  })();
});

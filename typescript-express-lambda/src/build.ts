import path from "path";
import fs from "fs";
import util from "util";
import template from "./template.json";
import zip from "adm-zip";

const rootPath = path.join(__dirname, "..");
const distFolder = path.join(rootPath, "dist");

const exec = util.promisify(require("child_process").exec);

async function build() {
  const packagejson = JSON.parse(
    fs.readFileSync(path.join(rootPath, "package.json"), "utf8")
  );
  let dependencies = {};
  if (packagejson.hasOwnProperty("dependencies")) {
    dependencies = packagejson.dependencies;
  }
  if (template.hasOwnProperty("layers")) {
    for (const [name, layer] of Object.entries(template.layers)) {
      const nodejsFolder = path.join(distFolder, layer.path, "nodejs");
      if (!fs.existsSync(nodejsFolder)) {
        fs.mkdirSync(nodejsFolder);
      }

      if (layer.hasOwnProperty("dependencies")) {
        dependencies = (layer as any).dependencies;
      }
      fs.writeFileSync(
        path.join(nodejsFolder, "package.json"),
        JSON.stringify(
          {
            dependencies,
          },
          null,
          2
        )
      );
      const { stdout, stderr } = await exec("npm i", { cwd: nodejsFolder });
      console.log(stdout);
      console.error(stderr);

      if (fs.existsSync(path.join(nodejsFolder, "..", name + ".zip"))) {
        fs.rmSync(path.join(nodejsFolder, "..", name + ".zip"));
      }
      const zipFile = new zip();
      zipFile.addLocalFolder(path.join(nodejsFolder, ".."));
      zipFile.writeZip(path.join(nodejsFolder, "..", name + ".zip"));
    }
  }
  if (template.hasOwnProperty("build")) {
    for (const [_, func] of Object.entries(template.functions)) {
      const module = await import(`./${func.path}`);

      const filePath = path.join(distFolder, func.path, "index.js");
      const fileContent = fs.readFileSync(filePath, "utf8");
      for (const [k, v] of Object.entries(template.build.import_paths)) {
        let newFileContent = fileContent.replaceAll(
          `require("${k}`,
          `require("${v}`
        );
        if ("default" in module) {
          newFileContent =
            newFileContent.replaceAll("exports.default = httpTrigger;", "") +
            `
const handler = async (event) => {
  const context = {
    log: (msg) => console.log(\`[\${new Date().toISOString()}] \${msg}\`),
    res: {
      status: 200,
      body: "",
    },
  };
  const req = {
    url: event.path,
    method: event.httpMethod,
    headers: event.headers,
    query: event.queryStringParameters,
    params: event.pathParameters,
    body: JSON.parse(event.body),
  };
  await httpTrigger(req, context);
  const { status, body, headers } = context.res;
  return {
    statusCode: status || 200,
    headers,
    body: typeof body == "object" ? JSON.stringify(body) : body,
  };
};

exports.handler = handler;
`;
        }
        fs.writeFileSync(filePath, newFileContent);
      }
    }
  }
  fs.rmSync(path.join(distFolder, "build.js"));
  if (fs.existsSync(path.join(distFolder, "build.js.map"))) {
    fs.rmSync(path.join(distFolder, "build.js.map"));
  }
}

async function buildForAzure() {
  const azureProjectFolderName = "azure_function";
  const azureProjectFolderPath = path.join(rootPath, azureProjectFolderName);
  if (fs.existsSync(azureProjectFolderPath)) {
    fs.rmSync(azureProjectFolderPath, { recursive: true });
  }
  const { stdout, stderr } = await exec(
    `func init ${azureProjectFolderName} --typescript --docker`
  );
  console.log(stdout);
  console.error(stderr);

  fs.cpSync(
    path.join(__dirname, "layers"),
    path.join(azureProjectFolderPath, "layers"),
    {
      recursive: true,
    }
  );

  const tsconfig = JSON.parse(
    fs.readFileSync(path.join(azureProjectFolderPath, "tsconfig.json"), "utf8")
  );
  tsconfig["compilerOptions"]["esModuleInterop"] = true;
  fs.writeFileSync(
    path.join(azureProjectFolderPath, "tsconfig.json"),
    JSON.stringify(tsconfig, null, 2)
  );

  let packagejson = JSON.parse(
    fs.readFileSync(path.join(rootPath, "package.json"), "utf8")
  );
  let dependencies = {};
  if (packagejson.hasOwnProperty("dependencies")) {
    dependencies = packagejson.dependencies;
  }
  packagejson = JSON.parse(
    fs.readFileSync(path.join(azureProjectFolderPath, "package.json"), "utf8")
  );
  if (packagejson.hasOwnProperty("dependencies")) {
    packagejson.dependencies = dependencies;
  }
  fs.writeFileSync(
    path.join(azureProjectFolderPath, "package.json"),
    JSON.stringify(packagejson, null, 2)
  );

  for (const [_, func] of Object.entries(template.functions)) {
    const module = await import(`./${func.path}`);
    const funcName = func.path.split("/")[func.path.split("/").length - 1];

    fs.cpSync(
      path.join(__dirname, func.path),
      path.join(azureProjectFolderPath, funcName),
      { recursive: true }
    );
    let fileContent = fs.readFileSync(
      path.join(azureProjectFolderPath, funcName, "index.ts"),
      "utf8"
    );
    if ("handler" in module) {
      fileContent =
        `import { AzureFunction, Context, HttpRequest } from "@azure/functions";
` +
        fileContent +
        `
const httpTrigger: AzureFunction = async function (
  context: Context,
  req: HttpRequest
): Promise<void> {
  context.log("HTTP trigger function processed a request.");
  const event: any = {
    path: req.url,
    httpMethod: req.method,
    headers: req.headers,
    queryStringParameters: req.query,
    pathParameters: req.params,
    body: JSON.stringify(req.body),
  };
  const lambdaResponse: APIGatewayProxyResult = await handler(event);
  context.res = {
    status: lambdaResponse.statusCode /* Defaults to 200 */,
    body: JSON.parse(lambdaResponse.body),
    headers: lambdaResponse.headers,
  };
};

export default httpTrigger;`;
    }
    fs.writeFileSync(
      path.join(azureProjectFolderPath, funcName, "index.ts"),
      fileContent
        .replaceAll('from "../../layers', 'from "../layers')
        .replaceAll("export const handler", "const handler")
    );
    fs.writeFileSync(
      path.join(azureProjectFolderPath, funcName, "function.json"),
      JSON.stringify(
        {
          bindings: [
            {
              authLevel: "anonymous",
              type: "httpTrigger",
              direction: "in",
              name: "req",
              methods: func.methods.map((method) => method.toLowerCase()),
            },
            {
              type: "http",
              direction: "out",
              name: "res",
            },
          ],
          scriptFile: `../dist/${funcName}/index.js`,
        },
        null,
        2
      )
    );
  }
}

build();
buildForAzure();

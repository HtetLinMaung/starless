#!/usr/bin/env node

import chalk from "chalk";
import inquirer from "inquirer";
import { createSpinner } from "nanospinner";
import fs from "fs";
import path from "path";
import util from "util";
import child_process from "child_process";
import { fileURLToPath } from "url";

const exec = util.promisify(child_process.exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function generateTsConfig(folderPath) {
  fs.writeFileSync(
    path.join(folderPath, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          module: "CommonJS",
          target: "esnext",
          noImplicitAny: true,
          preserveConstEnums: true,
          outDir: "./dist",
          sourceMap: true,
          rootDir: "./src",
          esModuleInterop: true,
          removeComments: true,
          resolveJsonModule: true,
        },
        include: ["src/**/*"],
        exclude: ["node_modules", "**/*.spec.ts"],
      },
      null,
      2
    )
  );
}

async function main() {
  const { project } = await inquirer.prompt({
    name: "project",
    type: "list",
    message: "Which project you want to generate?",
    // message: "ဘယ်ပရောဂျက်ကို ဖန်တီးချင်လဲ။",
    choices: ["typescript-express-lambda"],
  });
  const { folderName } = await inquirer.prompt({
    name: "folderName",
    type: "input",
    message: "What is the name of the folder?",
    // message: "ကျေးဇူးပြု၍ ဖိုင်တွဲအမည် ကိုရိုက်ထည့်ပါ။",
  });
  const folderPath = path.join(process.cwd(), folderName);
  if (fs.existsSync(folderPath)) {
    // throw new Error("ဖိုင်တွဲ ရှိနှင့်ပြီးဖြစ်သည်။");
    throw new Error("Folder already exists!");
  }
  fs.mkdirSync(folderPath);
  // let spinner = createSpinner(
  //   `${project} ကိုအခုစပြီး တည်ဆောက်နေပါသည်။ ကျေးဇူးပြုပြီးခဏစောင့်ပါ။`
  // ).start();
  let spinner = createSpinner(`Scaffolding ${project}`).start();
  switch (project) {
    case "typescript-express-lambda":
      generateTsConfig(folderPath);
      fs.cpSync(
        path.join(__dirname, project, "src"),
        path.join(folderPath, "src"),
        {
          recursive: true,
        }
      );
      for (const filename of ["docker-compose.yml", "Dockerfile"]) {
        fs.cpSync(
          path.join(__dirname, project, filename),
          path.join(folderPath, filename)
        );
      }

      spinner.success();
      // spinner = createSpinner("မှီခိုမှုများကို ထည့်သွင်းနေပါသည်။").start();
      spinner = createSpinner("Installing dependencies").start();
      await exec("npm init -y", { cwd: folderPath });
      const { stdout, stderr } = await exec(
        "npm i -D @types/adm-zip @types/aws-lambda @types/cors @types/express @types/node @azure/functions chalk@4.1.2 adm-zip cors dotenv express nodemon ts-node typescript",
        { cwd: folderPath }
      );
      console.log(stdout);
      console.log(chalk.red(stderr));
      let json = JSON.parse(
        fs.readFileSync(path.join(folderPath, "package.json"), "utf8")
      );
      json["scripts"] = {
        start: "ts-node src/index.ts",
        dev: "nodemon src/index.ts",
        build: "tsc && ts-node src/build.ts",
      };
      fs.writeFileSync(
        path.join(folderPath, "package.json"),
        JSON.stringify(json, null, 2)
      );
      fs.writeFileSync(
        path.join(folderPath, ".dockerignore"),
        `.git
.gitignore
node_modules
dist
.env
azure_function`
      );
      fs.writeFileSync(
        path.join(folderPath, ".gitignore"),
        `node_modules
dist
.env
azure_function`
      );
      spinner.success();
      console.log(`\nSuccess! Created ${folderName} at ${folderPath}\n`);
      console.log("Inside that directory, you can run several commands: \n");
      console.log(
        "  *",
        chalk.green("npm run dev  "),
        ": Starts the development server with hot reload.\n"
      );
      console.log(
        "  *",
        chalk.green("npm run build"),
        ": Bundles the app for aws lambda.\n"
      );
      console.log(
        "  *",
        chalk.green("npm start    "),
        ": Starts the server.\n"
      );
      console.log("Happy hacking!\n");

      // console.log(
      //   `\n${folderPath} တွင် ${folderName} ဖိုင်တွဲအမည်ဖြင့် တည်ဆောက်မှုအောင်မြင်ပါသည်။\n`
      // );
      // console.log(
      //   "ထိုဖိုင်တွဲအတွင်းတွင် လူကြီးမင်းသည် command အများအပြားကို လုပ်ဆောင်နိုင်ပါသည်။\n"
      // );
      // console.log(
      //   "  *",
      //   chalk.green("npm run dev  "),
      //   ": Hot reload ဖြင့် ဖွံ့ဖြိုးတိုးတက်ရေးဆာဗာကို စတင်ခြင်း။\n"
      // );
      // console.log(
      //   "  *",
      //   chalk.green("npm run build"),
      //   ": aws lambda အတွက် app ကို စုစည်းခြင်း။\n"
      // );
      // console.log(
      //   "  *",
      //   chalk.green("npm start    "),
      //   ": ဆာဗာကို စတင်ခြင်း။\n"
      // );
      // console.log(
      //   "ယခုအချိန်မှစ၍ လူကြီးမင်း ပျော်ရွှင်စွာ ပရိုဂရမ်ရေးနိုင်ပါသည်။\n"
      // );
      break;
    case "node-express":
      // const { isTs } = await inquirer.prompt({
      //   name: "isTs",
      //   type: "confirm",
      //   message: "Do you want to use typescript?",
      // });
      // if (isTs) {
      //   generateTsConfig(folderPath);
      //   fs.cpSync(
      //     path.join(__dirname, "typescript-node-express", "src"),
      //     path.join(folderPath, "src"),
      //     {
      //       recursive: true,
      //     }
      //   );
      //   spinner.success();
      //   spinner = createSpinner("Installing dependencies").start();
      //   await exec("npm init -y", { cwd: folderPath });
      //   const { stdout, stderr } = await exec(
      //     "npm i -D @types/cors @types/express @types/node nodemon ts-node typescript && npm i cors dotenv express",
      //     { cwd: folderPath }
      //   );
      //   console.log(stdout);
      //   console.log(chalk.red(stderr));
      //   let json = JSON.parse(
      //     fs.readFileSync(path.join(folderPath, "package.json"), "utf8")
      //   );
      //   json["scripts"] = {
      //     start: "ts-node src/index.ts",
      //     dev: "nodemon src/index.ts",
      //   };
      //   fs.writeFileSync(
      //     path.join(folderPath, "package.json"),
      //     JSON.stringify(json, null, 2)
      //   );
      //   spinner.success();
      //   console.log(`\nSuccess! Created ${folderName} at ${folderPath}\n`);
      //   console.log("Inside that directory, you can run several commands: \n");
      //   console.log(
      //     "  *",
      //     chalk.green("npm run dev  "),
      //     ": Starts the development server with hot reload.\n"
      //   );
      //   console.log(
      //     "  *",
      //     chalk.green("npm start    "),
      //     ": Starts the server.\n"
      //   );
      //   console.log("Happy hacking!\n");
      // }
      // const { project } = await inquirer.prompt({
      //   name: "project",
      //   type: "list",
      //   message: "Which template you want to use?",
      //   // message: "ဘယ်ပရောဂျက်ကို ဖန်တီးချင်လဲ။",
      //   choices: ["default", "node-express"],
      // });
      break;
  }
}

main();

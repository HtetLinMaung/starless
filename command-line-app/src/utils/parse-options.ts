export default function parseOptions(args: string[]) {
  const options = {};
  let i = 0;
  for (const arg of args) {
    if (arg.startsWith("-")) {
      if (args[i + 1] && !args[i + 1].startsWith("-")) {
        options[arg] = args[i + 1];
      } else {
        options[arg] = null;
      }
    }
    i++;
  }
  return options;
}

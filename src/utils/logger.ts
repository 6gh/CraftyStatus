import chalk from "chalk";

export const info = (message: unknown, force = false) => {
  if (process.env.NODE_ENV === "silent" && !force) return;

  const date = chalk.gray(`[${new Date().toLocaleString()}]`);
  console.log(
    `${date} ${force ? chalk.bgCyan("[INFO]") : chalk.cyan("[INFO]")}`,
    message
  );
};

export const warn = (message: unknown) => {
  const date = chalk.gray(`[${new Date().toLocaleString()}]`);
  console.log(`${date} ${chalk.yellow("[WARNING]")}`, message);
};

export const error = (message: unknown) => {
  const date = chalk.gray(`[${new Date().toLocaleString()}]`);
  console.log(`${date} ${chalk.bgRed("[ERROR]")}`, message);
};

export const debug = (message: unknown) => {
  if (process.env.NODE_ENV !== "development") return;

  const date = chalk.gray(`[${new Date().toLocaleString()}]`);
  console.log(`${date} ${chalk.magenta("[DEBUG]")}`, message);
};

export default {
  info,
  warn,
  error,
  debug,
};

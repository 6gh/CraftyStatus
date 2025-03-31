import chalk from "chalk";

export const info = (message: unknown) => {
  if (process.env.NODE_ENV === "silent") return;

  const date = chalk.gray(`[${new Date().toLocaleString()}]`);
  console.log(`${date} ${chalk.cyan("[INFO]")}`, message);
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

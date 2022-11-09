import { default as inquirer, Answers, QuestionCollection } from 'inquirer';
import { CliUx } from '@oclif/core';
export * from 'inquirer';

/**
 * Prompt user for information. See https://www.npmjs.com/package/inquirer for details.
 */
export async function prompt<T extends Answers = Answers>(questions: QuestionCollection<T>, initialAnswers?: Partial<T>) {
  return inquirer.prompt<T>(questions, initialAnswers);
}

/**
 * Prompt user for information with a timeout (in milliseconds). See https://www.npmjs.com/package/inquirer for more.
 */
// eslint-disable-next-line class-methods-use-this
export async function timedPrompt<T extends Answers>(
  questions: QuestionCollection<T>,
  ms = 10000,
  initialAnswers?: Partial<T>
): Promise<T> {
  let id: NodeJS.Timeout;
  const thePrompt = prompt<T>(questions, initialAnswers);
  const timeout = new Promise((_, reject) => {
    id = setTimeout(() => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      thePrompt.ui['activePrompt'].done();
      CliUx.ux.log();
      reject(new Error(`Timed out after ${ms} ms.`));
    }, ms).unref();
  });

  return Promise.race([timeout, thePrompt]).then((result) => {
    clearTimeout(id);
    return result as T;
  });
}

/**
 * Simplified prompt for single-question confirmation. Times out and throws after 10s
 *
 * @param message text to display.  Do not include a question mark.
 * @param ms milliseconds to wait for user input.  Defaults to 10s.
 * @return true if the user confirms, false if they do not.
 */
 export async function confirm(message: string, ms = 10_000): Promise<boolean> {
  const { confirmed } = await timedPrompt<{ confirmed: boolean }>(
    [ { name: 'confirmed', message, type: 'confirm', }, ], ms
  );
  return confirmed;
}

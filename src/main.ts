import * as core from '@actions/core';
import * as exec from '@actions/exec';

import * as path from 'path';

import * as input from './input';

/**
 * These environment variables are exposed for GitHub Actions.
 *
 * See https://bit.ly/2WlFUD7 for more information.
 */
const {GITHUB_TOKEN, GITHUB_WORKSPACE} = process.env;

export async function run(actionInput: input.Input): Promise<void> {
  const workdir = core.getInput('workdir') || '.';
  const cwd = path.relative(
    process.env['GITHUB_WORKSPACE'] || process.cwd(),
    workdir
  );

  try {
    const code = await core.group(
      'Running vale with reviewdog 🐶 ...',
      async (): Promise<number> => {
        // Vale output ...
        const output = await exec.getExecOutput(
          actionInput.exePath,
          actionInput.args,
          {
            cwd,
            ignoreReturnCode: true
          }
        );
        const code = output.exitCode;

        // Pipe to reviewdog ...
        process.env['REVIEWDOG_GITHUB_API_TOKEN'] = GITHUB_TOKEN;
        await exec.exec(
          '/bin/reviewdog',
          [
            '-f=rdjsonl',
            `-name=vale`,
            `-reporter=${core.getInput('reporter')}`,
            `-fail-on-error=${core.getInput('fail_on_error')}`,
            `-filter-mode=${core.getInput('filter_mode')}`,
            `-level=${code == 1 ? 'error' : 'info'}`
          ],
          {
            cwd,
            input: Buffer.from(output.stdout, 'utf-8'),
            ignoreReturnCode: true
          }
        );

        return code;
      }
    );

    if (code !== 0) {
      core.setFailed(`reviewdog exited with status code: ${code}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error);
    } else {
      core.setFailed(`${error}`);
    }
  }
}

async function main(): Promise<void> {
  try {
    const userToken = GITHUB_TOKEN as string;
    const workspace = GITHUB_WORKSPACE as string;

    const actionInput = await input.get(userToken, workspace);
    await run(actionInput);
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error);
    } else {
      core.setFailed(`${error}`);
    }
  }
}

main();

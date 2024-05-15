import { cosmiconfig } from 'cosmiconfig';

export async function getReleaseConfig(cwd: string) {
  const explorer = cosmiconfig('rc', {
    stopDir: cwd,
  });

  const { config } = (await explorer.search(cwd)) ?? {};

  return config || {};
}

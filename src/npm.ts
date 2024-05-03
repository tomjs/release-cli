import { run } from './utils.js';

export const getNpmTags = async (pkgName: string) => {
  const cmd = `npm view ${pkgName} dist-tags`;
  let tags: Record<string, string> = {};
  try {
    const result = await run(cmd, { spinner: `Fetching prerelease tags for ${pkgName}` });
    tags = JSON.parse(result);
  } catch {}

  return tags;
};

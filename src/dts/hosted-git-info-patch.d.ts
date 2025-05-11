// hosted-git-info-patch.d.ts
import 'hosted-git-info';

declare module 'hosted-git-info' {
  export default class GitHost {
    static parseUrl(url: string): URL | undefined;
  }
}

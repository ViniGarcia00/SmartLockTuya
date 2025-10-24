// Type declaration for string-similarity module
declare module 'string-similarity' {
  export interface Match {
    ratings: Array<{ target: string; rating: number }>;
    bestMatch: { target: string; rating: number };
    bestMatchIndex: number;
  }

  export function findBestMatch(
    mainString: string,
    targetStrings: string[]
  ): Match;

  export function compareTwoStrings(str1: string, str2: string): number;
}

import fs from "fs";
import { PullRequest } from "./entity";
import { uniq } from "underscore";
import { median as _median, quantileSeq, std as std_deviation } from "mathjs";
import { fetchAllMergedPullRequests } from "./github";

interface StatCommandOptions {
  input: string | undefined;
  start: string | undefined;
  end: string | undefined;
  query: string | undefined;
}
export async function statCommand(options: StatCommandOptions): Promise<void> {
  let prs: PullRequest[] = [];

  if (options.query) {
    prs = await fetchAllMergedPullRequests(options.query, options.start, options.end);
  } else if (options.input) {
    prs = createPullRequestsByLog(options.input);
  } else {
    console.error("You must specify either --query or --input");
    process.exit(1);
  }

  process.stdout.write(JSON.stringify(createStat(prs), undefined, 2));
}

interface PullRequestStat {
  count: number;
  authorCount: number;
  additionsAverage: number;
  additionsMedian: number;
  deletionsAverage: number;
  deletionsMedian: number;
  leadTimeSecondsAverage: number;
  leadTimeSecondsMedian: number;
  leadTimeSecondsDeviation: number;
  leadTimeSeconds80: number;
  leadTimeSeconds90: number;
  timeToMergeSecondsAverage: number;
  timeToMergeSecondsMedian: number;
  timeToMergeSecondsDeviation: number;
  timeToMergeSeconds80: number;
  timeToMergeSeconds90: number;
  timeToMergeFromFirstReviewSecondsAverage: number;
  timeToMergeFromFirstReviewSecondsMedian: number;
  timeToMergeFromFirstReviewSecondsDeviation: number;
  timeToMergeFromFirstReviewSeconds80: number;
  timeToMergeFromFirstReviewSeconds90: number;
  commitToPRSecondsAverage: number;
  commitToPRSecondsMedian: number;
  commitToPRSecondsDeviation: number;
  commitToPRSeconds80: number;
  commitToPRSeconds90: number;
}
export function createStat(prs: PullRequest[]): PullRequestStat {
  const leadTimes = prs.map((pr) => pr.leadTimeSeconds);
  const timeToMerges = prs.map((pr) => pr.timeToMergeSeconds);
  const commitToPRs = prs.map((pr) => pr.commitToPRSeconds);
  const timeToMergeFromFirstReviews = prs
    .map((pr) => pr.timeToMergeFromFirstReviewSeconds)
    .filter((x): x is number => x !== undefined);

  return {
    count: prs.length,
    authorCount: uniq(prs.map((pr) => pr.author)).length,
    additionsAverage: average(prs.map((pr) => pr.additions)),
    additionsMedian: median(prs.map((pr) => pr.additions)),
    deletionsAverage: average(prs.map((pr) => pr.deletions)),
    deletionsMedian: median(prs.map((pr) => pr.deletions)),
    leadTimeSecondsAverage: Math.floor(average(leadTimes)),
    leadTimeSecondsMedian: Math.floor(median(leadTimes)),
    leadTimeSecondsDeviation: Math.floor(std_deviation(leadTimes)),
    leadTimeSeconds80: Math.floor(quantileSeq(leadTimes, 0.8) as number),
    leadTimeSeconds90: Math.floor(quantileSeq(leadTimes, 0.9) as number),
    timeToMergeSecondsAverage: Math.floor(average(timeToMerges)),
    timeToMergeSecondsMedian: Math.floor(median(timeToMerges)),
    timeToMergeSecondsDeviation: Math.floor(std_deviation(timeToMerges)),
    timeToMergeSeconds80: Math.floor(quantileSeq(timeToMerges, 0.8) as number),
    timeToMergeSeconds90: Math.floor(quantileSeq(timeToMerges, 0.9) as number),
    timeToMergeFromFirstReviewSecondsAverage: Math.floor(average(timeToMergeFromFirstReviews)),
    timeToMergeFromFirstReviewSecondsMedian: Math.floor(median(timeToMergeFromFirstReviews)),
    timeToMergeFromFirstReviewSecondsDeviation: Math.floor(std_deviation(timeToMergeFromFirstReviews)),
    timeToMergeFromFirstReviewSeconds80: Math.floor(quantileSeq(timeToMergeFromFirstReviews, 0.8) as number),
    timeToMergeFromFirstReviewSeconds90: Math.floor(quantileSeq(timeToMergeFromFirstReviews, 0.9) as number),
    commitToPRSecondsAverage: Math.floor(average(commitToPRs)),
    commitToPRSecondsMedian: Math.floor(median(commitToPRs)),
    commitToPRSecondsDeviation: Math.floor(std_deviation(commitToPRs)),
    commitToPRSeconds80: Math.floor(quantileSeq(commitToPRs, 0.8) as number),
    commitToPRSeconds90: Math.floor(quantileSeq(commitToPRs, 0.9) as number),
  };
}

function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((prev, current) => prev + current) / numbers.length;
}

function median(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return _median(numbers);
}

export function createPullRequestsByLog(path: string): PullRequest[] {
  const logs = JSON.parse(fs.readFileSync(path, "utf8"));
  return logs.map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (p: any) =>
      new PullRequest(
        p.title,
        p.author,
        p.url,
        p.createdAt,
        p.mergedAt,
        p.additions,
        p.deletions,
        p.authoredDate,
        p.firstReviewedAt
      )
  );
}

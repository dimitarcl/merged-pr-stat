import { parseISO } from "date-fns";

export class PullRequest {
  public leadTimeSeconds: number;
  public timeToMergeSeconds: number;
  public commitToPRSeconds: number;
  public timeToMergeFromFirstReviewSeconds: number | undefined;
  public timeToFirstReviewSeconds: number | undefined;

  constructor(
    public title: string,
    public author: string | undefined,
    public url: string,
    public createdAt: string,
    public mergedAt: string,
    public additions: number,
    public deletions: number,
    public authoredDate: string,
    public firstReviewedAt: string | undefined,
    public commits: number,
    public reviews: number,
    public comments: number,
    public changedFiles: number,
  ) {
    const mergedAtMillis = parseISO(this.mergedAt).getTime();
    const createdAtMillis = parseISO(this.createdAt).getTime();
    this.leadTimeSeconds = (mergedAtMillis - parseISO(this.authoredDate).getTime()) / 1000;
    this.timeToMergeSeconds = (mergedAtMillis - createdAtMillis) / 1000;
    this.commitToPRSeconds = (createdAtMillis - parseISO(this.authoredDate).getTime()) / 1000;
    if (this.firstReviewedAt) {
        const firstReviewMS = parseISO(this.firstReviewedAt).getTime();
        this.timeToMergeFromFirstReviewSeconds = (mergedAtMillis - firstReviewMS) / 1000;
        this.timeToFirstReviewSeconds = (firstReviewMS - createdAtMillis ) / 1000
    } else {
        this.timeToMergeFromFirstReviewSeconds = undefined;
        this.timeToFirstReviewSeconds = undefined;
    }
  }
}

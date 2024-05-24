import { parseISO } from "date-fns";

export class PullRequest {
  public leadTimeSeconds: number;
  public timeToMergeSeconds: number;
  public commitToPRSeconds: number;
  public timeToMergeFromFirstReviewSeconds: number | undefined;
  public timeToFirstReviewSeconds: number | undefined;
  public timeToFirstApprove: number | undefined;
  public timeToLastApprove: number | undefined;

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
    public firstApprove: string | undefined,
    public lastApprove: string | undefined,
    public commits: number,
    public reviews: number,
    public comments: number,
    public changedFiles: number,
    public task: string,
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
    if (this.firstApprove) {
        const firstApproveMS = parseISO(this.firstApprove).getTime();
        this.timeToFirstApprove = (firstApproveMS - createdAtMillis) / 1000;
    } else {
        this.timeToFirstApprove = undefined;
    }
    if (this.lastApprove) {
        const lastApproveMS = parseISO(this.lastApprove).getTime();
        this.timeToLastApprove = (lastApproveMS - createdAtMillis) / 1000;
    } else {
        this.timeToLastApprove = undefined;
    }

  }
}

export class PullRequestReview {
  constructor(
    public title: string,
    public pr_author: string,
    public pr_url: string,
    public pr_createdAt: string,
    public pr_mergedAt: string,
    public comments: number,
    public changedFiles: number,
    public author: string,
    public url: string,
    public createdAt: string,
    public state: string,
  )
  {
  }
}

import { GraphQLClient, gql } from "graphql-request";
import { PullRequest, PullRequestReview } from "./entity";
import { parseISO } from "date-fns";

// GitHub.com https://api.github.com/graphql
// GitHub Enterprise https://<HOST>/api/graphql
const GITHUB_GRAPHQL_ENDPOINT = process.env.GITHUB_ENDPOINT || "https://api.github.com/graphql";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

export const graphQLClient = new GraphQLClient(GITHUB_GRAPHQL_ENDPOINT, {
  headers: {
    authorization: `Bearer ${GITHUB_TOKEN}`,
  },
  timeout: 3600_000,
});

export async function fetchAllMergedPullRequests(
  searchQuery: string,
  startDateString?: string,
  endDateString?: string
): Promise<[PullRequest[], PullRequestReview[]]> {
  const startDate = startDateString ? parseISO(startDateString).toISOString() : "";
  const endDate = endDateString ? parseISO(endDateString).toISOString() : "";

  let q = `is:pr is:merged ${searchQuery}`;
  if (startDate !== "" || endDate !== "") {
    q += ` merged:${startDate}..${endDate}`;
  }

  return fetchAllPullRequestsByQuery(q);
}

interface PullRequestNode {
  title: string;
  body: string;
  author: {
    login: string;
  } | null;
  url: string;
  createdAt: string;
  mergedAt: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  totalCommentsCount: number;
  commits: {
    nodes: {
      commit: {
        message: string;
        authoredDate: string;
      };
    }[];
  };
  reviews: {
    nodes: {
      createdAt: string;
      state: string;
      author: {
          login: string;
      } | null;
      url: string;
    }[];
  };
}

function firstApprove(reviews:any[]):string | undefined {
    let first = reviews.find((r) => r.state == 'APPROVED')
    return first? first.createdAt : undefined;
}

function lastApprove(reviews:any[]):string | undefined {
    for (let i = reviews.length - 1; i >= 0; --i)
    {
        let r = reviews[i];
        if (r.state == 'APPROVED') return r.createdAt;
    }
    return undefined;
}

function getTask(pull: PullRequestNode): string {
    const task_re = /(?:(?:COH)|(?:SUP))-[0-9]+/;
    let match = task_re.exec(pull.title);
    if (match) {
        return match[0];
    }
    match = task_re.exec(pull.body);
    if (match) {
        return match[0];
    }
    for (let commit of pull.commits.nodes) {
        match = task_re.exec(commit.commit.message);
        if (match) {
            return match[0];
        }
    }
    return "";
}

async function fetchAllPullRequestsByQuery(searchQuery: string): Promise<[PullRequest[], PullRequestReview[]]> {
  const query = gql`
    query($after: String) {
      search(type: ISSUE, first: 100, query: "${searchQuery}", after: $after) {
        issueCount
        nodes {
          ... on PullRequest {
            title
            body
            author {
              login
            }
            url
            createdAt
            mergedAt
            additions
            deletions
            changedFiles
            totalCommentsCount
            # for lead time
            commits(first:100) {
              nodes {
                commit {
                  message
                  authoredDate
                }
              }
            }
            # for time to merge from review
            reviews(first:100) {
              nodes {
                ... on PullRequestReview {
                  createdAt
                  state
                  url
                  author {
                    login
                  }
                }
              }
            }
          }
        }
        pageInfo {
          endCursor
          hasNextPage
        }
      }
      rateLimit {
        limit
        cost
        remaining
        resetAt
      }
    }
  `;

  let after: string | undefined;
  let reviews: PullRequestReview[] = [];
  let prs: PullRequest[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const data = await graphQLClient.request(query, { after });
    prs = prs.concat(
      data.search.nodes.map(
        (p: PullRequestNode) =>
        {
          let reviewCount = p.reviews.nodes.length;
          for (let i = 0; i < reviewCount; ++i)
          {
              reviews.push(new PullRequestReview(
                  p.title,
                  p.author ? p.author.login : "undefined",
                  p.url,
                  p.createdAt,
                  p.mergedAt,
                  p.totalCommentsCount,
                  p.changedFiles,
                  p.reviews.nodes[i].author ? p.reviews.nodes[i].author!.login : "undefined",
                  p.reviews.nodes[i].url,
                  p.reviews.nodes[i].createdAt,
                  p.reviews.nodes[i].state,
              ));
          }
          return new PullRequest(
            p.title,
            p.author ? p.author.login : undefined,
            p.url,
            p.createdAt,
            p.mergedAt,
            p.additions,
            p.deletions,
            p.commits.nodes[0] ? p.commits.nodes[0].commit.authoredDate : p.createdAt,
            p.reviews.nodes[0] ? p.reviews.nodes[0].createdAt : undefined,
            p.reviews.nodes.length ? firstApprove(p.reviews.nodes) : undefined,
            p.reviews.nodes.length ? lastApprove(p.reviews.nodes) : undefined,
            p.commits.nodes.length,
            p.reviews.nodes.length,
            p.totalCommentsCount,
            p.changedFiles,
            getTask(p),
          );
        }
      )
    );

    if (!data.search.pageInfo.hasNextPage) break;

    // console.error(JSON.stringify(data, undefined, 2));

    after = data.search.pageInfo.endCursor;
  }

  return [prs, reviews];
}

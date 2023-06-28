import { GraphQLClient, gql } from "graphql-request";
import { PullRequest } from "./entity";
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
): Promise<PullRequest[]> {
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
        authoredDate: string;
      };
    }[];
  };
  reviews: {
    nodes: {
      createdAt: string;
      state: string;
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

async function fetchAllPullRequestsByQuery(searchQuery: string): Promise<PullRequest[]> {
  const query = gql`
    query($after: String) {
      search(type: ISSUE, first: 100, query: "${searchQuery}", after: $after) {
        issueCount
        nodes {
          ... on PullRequest {
            title
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
  let prs: PullRequest[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const data = await graphQLClient.request(query, { after });
    prs = prs.concat(
      data.search.nodes.map(
        (p: PullRequestNode) =>
          new PullRequest(
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
          )
      )
    );

    if (!data.search.pageInfo.hasNextPage) break;

    // console.error(JSON.stringify(data, undefined, 2));

    after = data.search.pageInfo.endCursor;
  }

  return prs;
}

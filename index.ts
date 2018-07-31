import { execFileSync } from "child_process";

const LS_TREE_FORMAT = /(\d+) (commit|tree|blob|tag) ([0-9A-Za-z]+)\t([^\u0000]+)\u0000/g;
const LS_REMOTE_FORMAT = /([0-9A-Za-z]+)\t([^\n]+)\n/g;
const FETCH_PACK_FORMAT = /(?:pack|keep)\t([0-9A-Za-z]+)/g;
const CAT_FILE_TYPE = /(commit|tree|blob|tag)\n/g;
const LS_FILES = /([^\u0000]+)\u0000/g;

/**
 * Looks up the tag sha from the remote url, fetches it if not already
 * fetched, then reads the specified tree paths from the commit into
 * the index mapped to the specified prefixes, and checks out the index,
 * then resets the index.
 *
 * @param repoUrl the repository url
 * @param tagName the tag name
 * @param treePrefixMap a map of path in the commit to a target prefix
 */
export default function gitFetchDirs(
  repoUrl: string,
  tagName: string,
  treePrefixMap: { [path: string]: string }
) {
  let commitSha = fetchTagCommit(repoUrl, tagName);
  let treePaths = Object.keys(treePrefixMap);
  let treeShas = findTreeShas(commitSha, treePaths);
  // read trees into the index with the mapped prefixes
  treePaths.forEach(treePath => {
    let treeSha = treeShas[treePath];
    let prefix = treePrefixMap[treePath];
    readTree(treeSha, prefix);
  });
  // just in case stuff is already in the index only checkout and
  // reset stuff starting with the prefixes
  let prefixes = treePaths.map(treePath => treePrefixMap[treePath]);
  let files = findCachedFiles(prefixes);
  checkoutIndex(files);
  gitReset(prefixes);
}

export function fetchTagCommit(repoUrl: string, tagName: string) {
  let commitSha = resolveRemoteTag(repoUrl, tagName);
  if (commitSha === undefined) {
    throw new Error(`failed to resolve tag ${tagName} in ${repoUrl}`);
  }
  // fetch if we don't have already
  if (!isCommit(commitSha)) {
    fetchPack(repoUrl, commitSha);
  }
  return commitSha;
}

export function findCachedFiles(prefixes: string[]) {
  let out = git("ls-files", "--cached", "-z");
  let files = parseRows(LS_FILES, out).map(([file]) => file);
  return files.filter(file => startsWith(file, prefixes));
}

function startsWith(file: string, prefixes: string[]) {
  for (let i = 0; i < prefixes.length; i++) {
    if (file.lastIndexOf(prefixes[i], 0) === 0) {
      return true;
    }
  }
  return false;
}

export function isCommit(sha: string) {
  try {
    return shaType(sha) === "commit";
  } catch (e) {
    return false;
  }
}

export function shaType(sha: string) {
  let out = git("cat-file", "-t", sha);
  let [type] = parseRow(CAT_FILE_TYPE, out);
  return type;
}

export function resolveRemoteTag(
  repoUrl: string,
  tagName: string
): string | undefined {
  let out = git("ls-remote", "--exit-code", "--tags", repoUrl, tagName);
  let [tagSha] = parseRow(LS_REMOTE_FORMAT, out);
  return tagSha;
}

export function fetchPack(repoUrl: string, commitSha: string) {
  let out = git("fetch-pack", "--keep", "--depth=1", repoUrl, commitSha);
  let [packSha] = parseRow(FETCH_PACK_FORMAT, out);
  return packSha;
}

export function findTreeShas(commitSha: string, treePaths: string[]) {
  let out = git("ls-tree", "-z", "-d", commitSha, ...treePaths);
  let rows = parseRows(LS_TREE_FORMAT, out);
  let shas: {
    [path: string]: string;
  } = {};
  rows.forEach(([, , sha, path]) => {
    shas[path] = sha;
  });
  return shas;
}

export function readTree(treeSha: string, prefix: string) {
  git("read-tree", "--prefix", prefix, treeSha);
}

export function checkoutIndex(paths: string[]) {
  gitWithInput(["checkout-index", "-z", "--stdin"], paths.join("\u0000"));
}

export function gitReset(prefixes: string[]) {
  git("reset", "--", ...prefixes);
}

function parseRows(regex: RegExp, out: string) {
  let match: RegExpExecArray | null;
  let rows = [] as string[][];
  while ((match = regex.exec(out)) !== null) {
    let row = [];
    for (let i = 1; i < match.length; i++) {
      row.push(match[i]);
    }
    rows.push(row);
  }
  return rows;
}

function parseRow(regex: RegExp, out: string) {
  let rows = parseRows(regex, out);
  return rows.length > 0 ? rows[0] : ([] as string[]);
}

export function git(...args: string[]) {
  return execFileSync("git", args, { encoding: "utf8" });
}

export function gitWithInput(args: string[], input: string) {
  return execFileSync("git", args, { input, encoding: "utf8" });
}

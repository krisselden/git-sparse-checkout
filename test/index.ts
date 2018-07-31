import * as tmp from "tmp";
import * as fs from "fs";
import * as path from "path";
import { URL } from "url";
import gitFetchDirs, { resolveRemoteTag, fetchPack } from "../index";

let tmpDir: tmp.SynchrounousResult;

QUnit.module("git-fetch-trees", hooks => {
  hooks.beforeEach(() => {
    tmpDir = tmp.dirSync({
      // rm -rf
      unsafeCleanup: true
    });
  });

  hooks.afterEach(() => {
    tmpDir.removeCallback();
  });

  QUnit.test("resolveRemoteTag", assert => {
    let srcRepo = makeTmpRepo("src.git");
    srcRepo.writeFixture({
      commit: "1b19af1eabe42dffa9750aab25c853767edfa36c",
      tag: "v1.0.1"
    });

    assert.equal(
      resolveRemoteTag(srcRepo.url, "v1.0.1"),
      "1b19af1eabe42dffa9750aab25c853767edfa36c"
    );
  });

  QUnit.test("fetchPack", assert => {
    let srcRepo = makeTmpRepo("src.git");
    srcRepo.writeFixture({
      commit: "1b19af1eabe42dffa9750aab25c853767edfa36c",
      tag: "v1.0.1"
    });
    let targetRepo = makeTmpRepo("target.git");
    chdir(targetRepo.path(), () => {
      assert.equal(
        fetchPack(srcRepo.url, "1b19af1eabe42dffa9750aab25c853767edfa36c"),
        "579d0b09d25b2da9f41bbba575288e6293bac730"
      );
    });
  });

  QUnit.test("gitFetchDirs", assert => {
    let srcRepo = makeTmpRepo("src.git");
    srcRepo.writeFixture({
      commit: "1b19af1eabe42dffa9750aab25c853767edfa36c",
      tag: "v1.0.1"
    });
    let targetRepo = makeTmpRepo("target.git");

    chdir(targetRepo.path(), () => {
      gitFetchDirs(srcRepo.url, "v1.0.1", {
        a: "vendor/src/a/",
        "b/c": "vendor/src/b/c/"
      });

      assert.deepEqual(fs.readdirSync("vendor/src"), ["a", "b"]);
      assert.deepEqual(fs.readdirSync("vendor/src/a"), ["a.txt"]);
      assert.deepEqual(fs.readdirSync("vendor/src/b"), ["c"]);
      assert.deepEqual(fs.readdirSync("vendor/src/b/c"), [
        "one.txt",
        "two.txt"
      ]);
    });
  });
});

function chdir(dir: string, callback: () => void) {
  let original = process.cwd();
  try {
    process.chdir(dir);
    callback();
  } finally {
    process.chdir(original);
  }
}

interface Repo {
  name: string;
  url: string;
  path(...paths: string[]): string;
  writeFixture(options: { commit: string; tag?: string }): void;
}

function makeTmpRepo(name: string): Repo {
  let repoPath = path.join(tmpDir.name, name);
  let repo: Repo = {
    name,
    url: toFileURI(repoPath),
    path(...paths: string[]) {
      return path.join(repoPath, ...paths);
    },
    writeFixture({ commit, tag }) {
      copyFixturePack(this, commit);
      if (tag) {
        writeMaster(this, commit);
        writeTag(this, commit, tag);
      }
    }
  };
  fs.mkdirSync(repo.path());
  fs.mkdirSync(repo.path(".git"));
  fs.mkdirSync(repo.path(".git/objects"));
  fs.mkdirSync(repo.path(".git/objects/pack"));
  fs.mkdirSync(repo.path(".git/refs"));
  fs.mkdirSync(repo.path(".git/refs/heads"));
  fs.mkdirSync(repo.path(".git/refs/tags"));
  fs.writeFileSync(repo.path(".git/HEAD"), "ref: refs/heads/master\n");
  return repo;
}

function writeMaster(repo: Repo, sha: string) {
  fs.writeFileSync(repo.path(".git/refs/heads/master"), `${sha}\n`);
}

function writeTag(repo: Repo, sha: string, tag: string) {
  fs.writeFileSync(repo.path(".git/refs/tags", tag), `${sha}\n`);
}

function copyFixturePack(repo: Repo, sha: string) {
  fs.readdirSync(path.join("test/fixtures", sha)).forEach(packfile => {
    copyFile(
      path.join("test/fixtures", sha, packfile),
      repo.path(".git/objects/pack", packfile)
    );
  });
}

function toFileURI(file: string) {
  let resolved = path.resolve(file).replace(/\\/g, "/");
  if (resolved[0] !== "/") {
    resolved = "/" + resolved;
  }
  return `file://${resolved}`;
}

function copyFile(src: string, dest: string) {
  if (fs.copyFileSync) {
    fs.copyFileSync(src, dest);
  } else {
    fs.writeFileSync(dest, fs.readFileSync(src));
  }
}

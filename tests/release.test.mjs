import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { test } from "node:test";
import {
  nextReleaseTag,
  parseReleaseArgs,
  releaseProject,
} from "../scripts/release.mjs";
import {
  syncReleaseVersion,
  versionFiles,
} from "../scripts/release-version.mjs";

// 在临时仓库中执行 Git 操作。
function git(root, ...args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

// 创建工作仓库与本地裸远端，用于验证实际提交和推送行为。
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), "miraiplayer-release-"));
  t.after(() => {
    // Only remove this fixture's freshly allocated directory, including on Windows.
    const name = relative(resolve(tmpdir()), resolve(directory));
    assert.match(name, /^miraiplayer-release-[^/\\]+$/);
    rmSync(directory, { recursive: true, force: true });
  });
  const root = join(directory, "work");
  const remote = join(directory, "remote.git");
  mkdirSync(root);
  git(
    directory,
    "-c",
    "init.templateDir=",
    "init",
    "--bare",
    "--initial-branch=main",
    remote,
  );
  git(root, "-c", "init.templateDir=", "init", "--initial-branch=main");
  git(root, "config", "user.name", "Release Test");
  git(root, "config", "user.email", "release@example.test");
  git(root, "config", "commit.gpgsign", "false");
  git(root, "config", "tag.gpgsign", "false");
  git(root, "config", "core.autocrlf", "false");
  git(root, "config", "core.hooksPath", join(directory, "no-hooks"));
  mkdirSync(join(root, "src-tauri"));
  writeFileSync(
    join(root, "package.json"),
    '{"name":"miraiplayer","version":"0.1.0"}\n',
  );
  writeFileSync(
    join(root, "src-tauri/tauri.conf.json"),
    '{"version":"../package.json"}\n',
  );
  writeFileSync(
    join(root, "src-tauri/Cargo.toml"),
    '[package]\nname = "miraiplayer"\nversion = "0.1.0"\n',
  );
  writeFileSync(
    join(root, "src-tauri/Cargo.lock"),
    'version = 4\n\n[[package]]\nname = "miraiplayer"\nversion = "0.1.0"\n',
  );
  git(root, "add", ".");
  git(root, "commit", "-m", "Initial application");
  git(root, "remote", "add", "origin", remote);
  git(root, "push", "origin", "main");
  const logs = [];
  return {
    root,
    remote,
    directory,
    logs,
    run: (options = {}) =>
      releaseProject(root, {
        log: (message) => logs.push(message),
        ...options,
      }),
  };
}

test("chooses a numeric maximum across source, local tags and remote tags", () => {
  assert.equal(nextReleaseTag("0.1.0", ["v1.0.0", "v1.0.1"]), "v1.0.2");
  assert.equal(
    nextReleaseTag("0.1.0", ["v1.9.9", "v1.10.0", "v1.2.99", "other"]),
    "v1.10.1",
  );
  assert.equal(nextReleaseTag("2.3.4", ["v1.0.1"]), "v2.3.5");
  assert.equal(nextReleaseTag("1.2.3", [], "minor"), "v1.3.0");
  assert.equal(nextReleaseTag("1.2.3", [], "major"), "v2.0.0");
  assert.equal(nextReleaseTag("0.1.0", ["v2.0.0-beta.1"]), "v2.0.1");
  assert.throws(() => nextReleaseTag("1.0.65535", []), /标签格式/);
  assert.throws(() => nextReleaseTag("1.0.0", [], "invalid"), /升级类型/);
});

test("CLI validates bump, preview and retry arguments", () => {
  assert.deepEqual(parseReleaseArgs([]), { bump: "patch", dryRun: false });
  assert.deepEqual(parseReleaseArgs(["--", "minor", "--dry-run"]), {
    bump: "minor",
    dryRun: true,
  });
  assert.equal(parseReleaseArgs(["--retry", "v1.0.2"]).retry, "v1.0.2");
  for (const args of [
    ["patch", "minor"],
    ["--force"],
    ["--retry"],
    ["--retry", "v1.0.2", "major"],
  ])
    assert.throws(() => parseReleaseArgs(args));
});

test("a release synchronizes application versions and pushes only the new tag and branch", (t) => {
  const { root, remote, run } = fixture(t);
  git(root, "tag", "-a", "v1.0.1", "-m", "Existing release");
  git(root, "tag", "-a", "unrelated", "-m", "Must remain local");
  git(root, "config", "push.followTags", "true");
  git(root, "push", "--no-follow-tags", "origin", "refs/tags/v1.0.1");
  // Simulate a newer release that exists only on the server.
  git(remote, "update-ref", "refs/tags/v1.0.2", git(root, "rev-parse", "HEAD"));
  assert.equal(run().tag, "v1.0.3");
  assert.equal(
    syncReleaseVersion(root, "v1.0.3", { check: true }).version,
    "1.0.3",
  );
  const head = git(root, "rev-parse", "HEAD");
  assert.equal(git(remote, "rev-parse", "main"), head);
  assert.equal(git(remote, "rev-parse", "v1.0.3^{commit}"), head);
  assert.equal(git(remote, "cat-file", "-t", "refs/tags/v1.0.3"), "tag");
  assert.equal(git(root, "log", "-1", "--format=%s"), "chore(release): v1.0.3");
  assert.deepEqual(
    git(root, "diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD")
      .split("\n")
      .sort(),
    [...versionFiles].sort(),
  );
  assert.equal(git(root, "status", "--porcelain"), "");
  assert.equal(git(remote, "tag", "--list", "unrelated"), "");
});

test("preview reads remote tags without changing files, commits or refs, even with local edits", (t) => {
  const { root, remote, run, logs } = fixture(t);
  const before = versionFiles.map((file) =>
    readFileSync(join(root, file), "utf8"),
  );
  const head = git(root, "rev-parse", "HEAD");
  git(remote, "update-ref", "refs/tags/v1.0.9", head);
  writeFileSync(join(root, "work-in-progress.txt"), "Uncommitted work");
  assert.equal(run({ dryRun: true }).tag, "v1.0.10");
  assert.deepEqual(
    versionFiles.map((file) => readFileSync(join(root, file), "utf8")),
    before,
  );
  assert.equal(git(root, "rev-parse", "HEAD"), head);
  assert.equal(git(remote, "rev-parse", "main"), head);
  assert.equal(git(root, "tag", "--list"), "");
  assert.equal(git(remote, "tag", "--list"), "v1.0.9");
  assert.ok(logs.some((message) => message.includes("未提交改动")));
});

test("dirty tracked, staged and untracked work prevents a release", (t) => {
  const { root, remote, run } = fixture(t);
  const head = git(root, "rev-parse", "HEAD");
  writeFileSync(
    join(root, "package.json"),
    '{"name":"miraiplayer","version":"0.1.0","private":true}\n',
  );
  assert.throws(() => run(), /未提交/);
  git(root, "add", "package.json");
  assert.throws(() => run(), /未提交/);
  git(root, "restore", "--staged", "--worktree", "package.json");
  writeFileSync(join(root, "unfinished.txt"), "Keep this file");
  assert.throws(() => run(), /未提交/);
  assert.equal(
    readFileSync(join(root, "unfinished.txt"), "utf8"),
    "Keep this file",
  );
  assert.equal(git(root, "rev-parse", "HEAD"), head);
  assert.equal(git(remote, "tag", "--list"), "");
});

test("a remote branch ahead of the checkout is rejected before any version changes", (t) => {
  const { root, remote, directory, run } = fixture(t);
  const other = join(directory, "other");
  git(directory, "clone", remote, other);
  writeFileSync(join(other, "new.txt"), "Remote update");
  git(other, "add", "new.txt");
  git(
    other,
    "-c",
    "user.name=Other",
    "-c",
    "user.email=other@example.test",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "-m",
    "Remote update",
  );
  git(other, "push", "origin", "main");
  const before = readFileSync(join(root, "package.json"), "utf8");
  assert.throws(() => run(), /最新提交/);
  assert.equal(readFileSync(join(root, "package.json"), "utf8"), before);
  assert.equal(git(root, "tag", "--list"), "");
});

test("atomic push rejection leaves no remote tag and retry reuses the exact release commit", (t) => {
  const { root, remote, run } = fixture(t);
  const before = git(remote, "rev-parse", "main");
  const hook = join(remote, "hooks", "update");
  mkdirSync(join(remote, "hooks"), { recursive: true });
  git(remote, "config", "core.hooksPath", join(remote, "hooks"));
  writeFileSync(
    hook,
    '#!/bin/sh\nif [ "$1" = "refs/heads/main" ]; then exit 1; fi\nexit 0\n',
  );
  chmodSync(hook, 0o755);
  assert.throws(() => run(), /pnpm release --retry v0.1.1/);
  const prepared = git(root, "rev-parse", "HEAD");
  assert.notEqual(prepared, before);
  assert.equal(git(remote, "rev-parse", "main"), before);
  assert.equal(git(remote, "tag", "--list"), "");
  assert.throws(() => run(), /尚未推送/);
  rmSync(hook);
  assert.equal(run({ retry: "v0.1.1" }).tag, "v0.1.1");
  assert.equal(git(root, "rev-parse", "HEAD"), prepared);
  assert.equal(git(remote, "rev-parse", "main"), prepared);
  assert.equal(git(remote, "rev-parse", "v0.1.1^{commit}"), prepared);
  assert.equal(git(remote, "tag", "--list"), "v0.1.1");
});

test("retry rejects a mismatching remote tag without overwriting it", (t) => {
  const { root, remote, run } = fixture(t);
  run();
  const original = git(remote, "rev-parse", "main~1");
  git(remote, "update-ref", "refs/tags/v0.1.1", original);
  assert.throws(() => run({ retry: "v0.1.1" }), /远程.*不同/);
  assert.equal(git(remote, "rev-parse", "refs/tags/v0.1.1"), original);
});

test("detached HEAD is rejected without creating a version", (t) => {
  const { root, run } = fixture(t);
  git(root, "checkout", "--detach");
  assert.throws(() => run(), /detached HEAD/);
  assert.equal(
    syncReleaseVersion(root, undefined, { check: true }).version,
    "0.1.0",
  );
});

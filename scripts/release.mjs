import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseReleaseTag,
  syncReleaseVersion,
  versionFiles,
} from "./release-version.mjs";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const bumpTypes = ["patch", "minor", "major"];
const usage = `用法：
  pnpm release                     补丁版本 +1，提交版本文件并推送分支和标签
  pnpm release minor               次版本 +1
  pnpm release major               主版本 +1
  pnpm release --dry-run           只预览，不修改文件、提交或推送
  pnpm release --retry v1.0.2      重试推送已准备好的版本，不再递增

发版前请先提交源码改动。安装包由 GitHub Actions 构建并发布。`;

// 解析版本递增、预览和重试参数。
export function parseReleaseArgs(args) {
  const options = { bump: "patch", dryRun: false };
  let hasBump = false;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--") continue;
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--retry" && !options.retry) {
      options.retry = parseReleaseTag(args[++index]).tag;
    } else if (bumpTypes.includes(arg) && !hasBump) {
      options.bump = arg;
      hasBump = true;
    } else throw new Error(`不支持的参数：${arg}\n${usage}`);
  }
  if (options.retry && hasBump)
    throw new Error("--retry 不能与 patch/minor/major 同时使用");
  return options;
}

// 在应用版本和现有版本标签中计算下一个版本。
export function nextReleaseTag(currentVersion, tags, bump = "patch") {
  if (!bumpTypes.includes(bump)) throw new Error(`不支持的升级类型：${bump}`);
  const parts = (tag) =>
    parseReleaseTag(tag).version.split("-")[0].split(".").map(Number);
  let latest = parts(`v${currentVersion}`);
  for (const tag of tags) {
    let candidate;
    try {
      candidate = parts(tag);
    } catch {
      continue; // Unrelated tags do not participate in application versioning.
    }
    const differing = candidate.findIndex(
      (part, index) => part !== latest[index],
    );
    if (differing !== -1 && candidate[differing] > latest[differing])
      latest = candidate;
  }
  const index = { major: 0, minor: 1, patch: 2 }[bump];
  latest[index]++;
  latest.fill(0, index + 1);
  return parseReleaseTag(`v${latest.join(".")}`).tag;
}

// 在指定仓库执行 Git 命令并传回结果。
function git(root, ...args) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `Git 操作失败：${result.stderr.trim() || result.stdout.trim()}`,
    );
  return result.stdout.trim();
}

// 检查版本并将已准备的版本提交和单个标签一起推送。
export function releaseProject(
  root,
  { bump = "patch", dryRun = false, retry, log = console.log } = {},
) {
  const branch = git(root, "branch", "--show-current");
  if (!branch)
    throw new Error("当前处于 detached HEAD，请先切换到要发布的分支");
  const dirty = git(
    root,
    "status",
    "--porcelain=v1",
    "--untracked-files=normal",
  );
  if (dirty && !dryRun)
    throw new Error(
      "存在未提交的改动，请先提交准备发布的源码，再运行 pnpm release",
    );

  // Inspect the actual push destination, which can differ from the fetch URL.
  const destinations = git(
    root,
    "remote",
    "get-url",
    "--push",
    "--all",
    "origin",
  ).split(/\r?\n/);
  if (destinations.length !== 1)
    throw new Error("origin 配置了多个推送地址，请先配置唯一的发版目标");
  const branchRef = `refs/heads/${branch}`;
  log("正在检查 origin 的版本标签和分支…");
  const refs = new Map(
    git(root, "ls-remote", "--refs", destinations[0], branchRef, "refs/tags/v*")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const [sha, ref] = line.split(/\s+/);
        return [ref, sha];
      }),
  );
  const remoteCommit = refs.get(branchRef);
  if (remoteCommit) {
    try {
      git(root, "merge-base", "--is-ancestor", remoteCommit, "HEAD");
    } catch {
      throw new Error(
        `当前分支未包含 origin/${branch} 的最新提交，请先拉取并整合远程改动`,
      );
    }
  }

  const current = syncReleaseVersion(root, undefined, { check: true });
  const localTags = git(root, "tag", "--list", "v*").split(/\r?\n/);
  const remoteTags = [...refs.keys()]
    .filter((ref) => ref.startsWith("refs/tags/"))
    .map((ref) => ref.slice("refs/tags/".length));
  const tag = retry
    ? parseReleaseTag(retry).tag
    : nextReleaseTag(current.version, [...localTags, ...remoteTags], bump);

  if (retry) {
    syncReleaseVersion(root, tag, { check: true });
    if (
      !localTags.includes(tag) ||
      git(root, "rev-parse", `${tag}^{commit}`) !==
        git(root, "rev-parse", "HEAD")
    )
      throw new Error(
        `重试要求本地 ${tag} 标签指向当前 HEAD，请先检查版本提交`,
      );
    const remoteTag = refs.get(`refs/tags/${tag}`);
    if (remoteTag && remoteTag !== git(root, "rev-parse", `refs/tags/${tag}`))
      throw new Error(`远程 ${tag} 与本地标签不同，不能覆盖，请检查远程版本`);
  } else if (
    localTags.includes(current.tag) &&
    !remoteTags.includes(current.tag)
  ) {
    if (
      git(root, "rev-parse", `${current.tag}^{commit}`) ===
      git(root, "rev-parse", "HEAD")
    )
      throw new Error(
        `检测到尚未推送的 ${current.tag}，请运行 pnpm release --retry ${current.tag}`,
      );
  }

  log(
    `${retry ? "重试版本" : "即将发布"}：${tag}（本地应用版本 ${current.version}）`,
  );
  log(`推送目标：origin/${branch} 和 ${tag}`);
  if (dryRun) {
    if (dirty) log("提示：当前存在未提交改动，正式发版前需先提交。");
    log("预览完成，未修改文件、创建提交、创建标签或推送。");
    return { tag, branch, dryRun: true };
  }

  if (!retry) {
    // Fail before editing files if Git has no usable author/committer identity.
    git(root, "var", "GIT_AUTHOR_IDENT");
    git(root, "var", "GIT_COMMITTER_IDENT");
    syncReleaseVersion(root, tag);
    git(root, "add", "--", ...versionFiles);
    try {
      git(root, "commit", "-m", `chore(release): ${tag}`);
      if (git(root, "status", "--porcelain=v1", "--untracked-files=normal"))
        throw new Error("提交后仍有文件改动，请检查 Git hooks 的执行结果");
      syncReleaseVersion(root, tag, { check: true });
      git(root, "tag", "-a", tag, "-m", `MiraiPlayer ${tag}`);
    } catch (error) {
      throw new Error(
        `${error.message}\n发版准备中断，尚未推送；已保留本地改动，请检查 git status 和 git log。`,
      );
    }
  }

  try {
    // Both refs must succeed together; a protected/advanced branch cannot leave
    // behind a new release tag. Never force-push or upload unrelated tags.
    git(
      root,
      "push",
      "--atomic",
      "--no-follow-tags",
      "origin",
      `HEAD:${branchRef}`,
      `refs/tags/${tag}:refs/tags/${tag}`,
    );
  } catch (error) {
    throw new Error(
      `${error.message}\n已保留版本提交和标签。解决推送问题后运行：pnpm release --retry ${tag}`,
    );
  }
  log(
    `${tag} 已推送。请在 GitHub Actions → Desktop packages 查看打包与发布进度。`,
  );
  return { tag, branch, dryRun: false };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const options = parseReleaseArgs(process.argv.slice(2));
    if (options.help) console.log(usage);
    else releaseProject(projectRoot, options);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

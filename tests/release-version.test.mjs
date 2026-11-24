import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { test } from "node:test";
import {
  parseReleaseTag,
  syncReleaseVersion,
} from "../scripts/release-version.mjs";

// 创建相互独立的版本文件以测试同步和异常分支。
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "miraiplayer-version-"));
  t.after(() => {
    assert.match(relative(resolve(tmpdir()), resolve(root)), /^miraiplayer-version-[^/\\]+$/);
    rmSync(root, { recursive: true, force: true });
  });
  mkdirSync(join(root, "src-tauri"));
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      name: "miraiplayer",
      version: "0.1.0",
      dependencies: { keep: "1.0.0" },
    }),
  );
  writeFileSync(
    join(root, "src-tauri/tauri.conf.json"),
    JSON.stringify({ version: "../package.json", productName: "MiraiPlayer" }),
  );
  writeFileSync(
    join(root, "src-tauri/Cargo.toml"),
    '[package]\nname = "miraiplayer"\nversion = "0.1.0"\n\n[dependencies]\nkeep = { version = "1.0.0" }\n',
  );
  writeFileSync(
    join(root, "src-tauri/Cargo.lock"),
    '# Generated\nversion = 4\n\n[[package]]\nname = "before"\nversion = "0.1.0"\n\n[[package]]\nname = "miraiplayer"\nversion = "0.1.0"\ndependencies = ["before"]\n\n[[package]]\nname = "after"\nversion = "0.1.0"\n',
  );
  return root;
}

test("accepts stable and numbered prerelease tags", () => {
  assert.deepEqual(parseReleaseTag("v1.2.3"), {
    tag: "v1.2.3",
    version: "1.2.3",
    prerelease: false,
  });
  for (const channel of ["alpha", "beta", "rc"])
    assert.equal(parseReleaseTag(`v0.2.0-${channel}.1`).prerelease, true);
});

test("rejects malformed tags, shell/path characters and Windows version overflow", () => {
  for (const tag of [
    "",
    "1.2.3",
    "v1.2",
    "v01.2.3",
    "v1.2.3-beta",
    "v1.2.3-beta.01",
    "v1.2.3+build",
    "v1.2.3\n",
    "v1.2.3\r\n",
    "v1.2.3/other",
    "v1.2.3;echo secret",
    "v65536.0.0",
    "v0.65536.0",
    "v0.0.65536",
  ]) {
    assert.throws(() => parseReleaseTag(tag), /标签格式/);
  }
});

test("synchronizes application versions without changing dependency or lock format versions", (t) => {
  const root = fixture(t);
  syncReleaseVersion(root, "v2.3.4-beta.1");
  assert.equal(
    syncReleaseVersion(root, undefined, { check: true }).version,
    "2.3.4-beta.1",
  );
  assert.equal(
    JSON.parse(readFileSync(join(root, "package.json"))).dependencies.keep,
    "1.0.0",
  );
  assert.match(
    readFileSync(join(root, "src-tauri/Cargo.toml"), "utf8"),
    /keep = \{ version = "1.0.0" \}/,
  );
  const lock = readFileSync(join(root, "src-tauri/Cargo.lock"), "utf8");
  assert.match(lock, /version = 4/);
  assert.match(lock, /name = "before"\nversion = "0.1.0"/);
  assert.match(lock, /name = "after"\nversion = "0.1.0"/);
});

test("check detects a mismatch without modifying any version", (t) => {
  const root = fixture(t);
  assert.throws(
    () => syncReleaseVersion(root, "v1.0.0", { check: true }),
    /版本号不一致/,
  );
  assert.equal(
    syncReleaseVersion(root, undefined, { check: true }).version,
    "0.1.0",
  );
  writeFileSync(join(root, "src-tauri/tauri.conf.json"), '{"version":"0.1.1"}');
  assert.throws(
    () => syncReleaseVersion(root, undefined, { check: true }),
    /tauri.conf.json/,
  );
});

test("invalid or ambiguous Rust configuration fails before any file is written", (t) => {
  for (const cargo of [
    '[package]\nname = "wrong"\nversion = "0.1.0"',
    '[package]\nname = "miraiplayer"\nversion = "0.1.0"\nversion = "0.2.0"',
  ]) {
    const root = fixture(t);
    const before = readFileSync(join(root, "package.json"), "utf8");
    writeFileSync(join(root, "src-tauri/Cargo.toml"), cargo);
    assert.throws(() => syncReleaseVersion(root, "v1.0.0"), /必须包含唯一/);
    assert.equal(readFileSync(join(root, "package.json"), "utf8"), before);
  }
});

test("handles CRLF and a final Cargo package with no trailing newline", (t) => {
  const root = fixture(t);
  writeFileSync(
    join(root, "src-tauri/Cargo.lock"),
    'version = 4\r\n\r\n[[package]]\r\nname = "miraiplayer"\r\nversion = "0.1.0"',
  );
  syncReleaseVersion(root, "v0.3.0");
  assert.equal(
    syncReleaseVersion(root, undefined, { check: true }).version,
    "0.3.0",
  );
});

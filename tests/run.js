import assert from "node:assert";
import { splitPath, joinPath, pathDepth, rebasePath } from "../ns.js";
import { makeDir } from "../ops.js";
import { render } from "../app.js";

const base = {
  state: {
    entries: [["/", 1]],
    nodes: { "1": { kind: "dir", links: 1 } },
    counts: { mkdir: 0, create: 0, link: 0, drop: 0, move: 0 },
    freed: 0,
    errs: []
  },
  events: [{ kind: "mkdir", path: "/a" }]
};

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

check("splitPath 给数组", () => {
  assert.ok(Array.isArray(splitPath("/a/b")));
});

check("joinPath 给字符串", () => {
  assert.strictEqual(typeof joinPath(["a"]), "string");
});

check("pathDepth 给数字", () => {
  assert.strictEqual(typeof pathDepth("/a"), "number");
});

check("rebasePath 给字符串", () => {
  assert.strictEqual(typeof rebasePath("/a/b", "/a", "/x"), "string");
});

check("makeDir 给状态", () => {
  assert.ok(Array.isArray(makeDir(base.state, "/a").entries));
});

check("render 数事件", () => {
  assert.strictEqual(typeof render(base).count_events, "number");
});

console.log("6 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);

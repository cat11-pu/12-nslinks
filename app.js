// app.js：把事件流跑成验收视图（条目表、节点表、深度、空目录、计数与四条不变量）
import { splitPath, joinPath, pathDepth, rebasePath } from "./ns.js";
import { makeDir, makeFile, makeLink, dropPath, movePath } from "./ops.js";

function codeOf(error) {
  if (error && error.code) { return String(error.code); }
  if (error && error.message) { return String(error.message); }
  return "E_FAIL";
}

function copyState(state) {
  const nodes = {};
  const rawNodes = (state && state.nodes) || {};
  for (const key of Object.keys(rawNodes)) {
    const node = rawNodes[key] || {};
    nodes[key] = { kind: node.kind, links: typeof node.links === "number" ? node.links : 0 };
  }
  const entries = [];
  const rawEntries = (state && state.entries) || [];
  if (Array.isArray(rawEntries)) {
    for (const pair of rawEntries) {
      if (Array.isArray(pair) && pair.length >= 2) { entries.push([String(pair[0]), pair[1]]); }
    }
  }
  const counts = { mkdir: 0, create: 0, link: 0, drop: 0, move: 0 };
  const rawCounts = (state && state.counts) || {};
  for (const key of Object.keys(counts)) {
    if (typeof rawCounts[key] === "number") { counts[key] = rawCounts[key]; }
  }
  const errs = [];
  const rawErrs = (state && state.errs) || [];
  if (Array.isArray(rawErrs)) {
    for (const row of rawErrs) {
      if (Array.isArray(row)) { errs.push([String(row[0]), String(row[1])]); }
    }
  }
  const freed = state && typeof state.freed === "number" ? state.freed : 0;
  return { nodes: nodes, entries: entries, counts: counts, freed: freed, errs: errs };
}

function step(state, event) {
  const kind = event ? event.kind : null;
  if (kind === "mkdir") { return makeDir(state, event.path); }
  if (kind === "create") { return makeFile(state, event.path); }
  if (kind === "link") { return makeLink(state, event.from, event.to); }
  if (kind === "unlink") { return dropPath(state, event.path); }
  if (kind === "rename") { return movePath(state, event.from, event.to); }
  throw Object.assign(new Error("E_BAD_EVENT"), { code: "E_BAD_EVENT" });
}

function walk(state, events) {
  let current = state;
  let failed = 0;
  for (const event of events || []) {
    try {
      current = step(current, event);
    } catch (error) {
      failed += 1;
      const held = copyState(current);
      held.errs.push([event && event.kind ? String(event.kind) : "?", codeOf(error)]);
      current = held;
    }
  }
  return { state: current, failed: failed };
}

function safe(fn, fallback) {
  try { return fn(); } catch (error) { return fallback; }
}

function fingerprint(state) {
  return JSON.stringify([state.entries, state.nodes, state.counts, state.freed]);
}

export function render(spec) {
  const source = copyState(spec.state);
  const events = (spec.events || []).slice();
  const run = walk(copyState(source), events);
  const state = run.state;
  const entries = state.entries.map(function (pair) { return [pair[0], pair[1]]; });
  const nodes = state.nodes;
  const seen = {};
  let ordered = true;
  let noOrphan = true;
  let linksOk = true;
  for (let at = 0; at < entries.length; at += 1) {
    if (at > 0 && !(entries[at - 1][0] < entries[at][0])) { ordered = false; }
    const key = String(entries[at][1]);
    seen[key] = (seen[key] || 0) + 1;
    if (!nodes[key]) { noOrphan = false; }
  }
  for (const key of Object.keys(nodes)) {
    if (nodes[key].links !== (seen[key] || 0)) { linksOk = false; }
    if (!seen[key]) { noOrphan = false; }
  }
  const nodeTable = Object.keys(nodes)
    .map(function (key) { return [Number(key), nodes[key].kind, nodes[key].links]; })
    .sort(function (a, b) { return a[0] - b[0]; });
  let maxDepth = 0;
  let emptyDirs = 0;
  let multiLink = 0;
  for (const pair of entries) {
    const depth = safe(function () { return pathDepth(pair[0]); }, 0);
    if (typeof depth === "number" && depth > maxDepth) { maxDepth = depth; }
    const node = nodes[String(pair[1])];
    if (node && node.kind === "dir") {
      const prefix = pair[0] === "/" ? "/" : pair[0] + "/";
      let kids = 0;
      for (const other of entries) {
        if (other[0] !== pair[0] && other[0].indexOf(prefix) === 0) { kids += 1; }
      }
      if (kids === 0) { emptyDirs += 1; }
    }
  }
  for (const key of Object.keys(nodes)) {
    if (nodes[key].kind === "file" && nodes[key].links >= 2) { multiLink += 1; }
  }
  let nextId = 1;
  while (nodes[String(nextId)]) { nextId += 1; }
  const half = Math.ceil(events.length / 2);
  const left = walk(copyState(source), events.slice(0, half));
  const right = walk(left.state, events.slice(half));
  const again = walk(copyState(source), events);
  return {
    entries: entries,
    nodes: nodes,
    node_table: nodeTable,
    max_depth: maxDepth,
    empty_dirs: emptyDirs,
    counts: state.counts,
    freed: state.freed,
    next_id: nextId,
    multi_link: multiLink,
    links_ok: linksOk,
    no_orphan: noOrphan,
    ordered: ordered,
    replay_new: fingerprint(again.state) === fingerprint(state) ? 0 : 1,
    replay_failed: again.failed,
    mid_differs: fingerprint(left.state) !== fingerprint(state),
    split_equal: fingerprint(right.state) === fingerprint(again.state),
    failed: run.failed,
    errs: state.errs,
    count_events: events.length,
    tail: [safe(function () { return splitPath("/a/b").length; }, -1),
           safe(function () { return joinPath(["a", "b"]); }, ""),
           safe(function () { return pathDepth("/a/b/c"); }, -1),
           safe(function () { return rebasePath("/a/b/c", "/a", "/x"); }, ""),
           safe(function () { return rebasePath("/z", "/a", "/x"); }, "")]
  };
}

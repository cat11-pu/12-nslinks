// ops.js：建目录、建文件、建链接、删除、重命名；出错抛带 code 的错误且不改状态
import { splitPath, joinPath, rebasePath } from "./ns.js";

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function cloneState(state) {
  const entries = (state.entries || []).map((pair) => [pair[0], pair[1]]);
  const nodes = {};
  for (const key of Object.keys(state.nodes || {})) {
    nodes[key] = { kind: state.nodes[key].kind, links: state.nodes[key].links };
  }
  const base = state.counts || {};
  const counts = {
    mkdir: base.mkdir || 0,
    create: base.create || 0,
    link: base.link || 0,
    drop: base.drop || 0,
    move: base.move || 0
  };
  return {
    entries: entries,
    nodes: nodes,
    counts: counts,
    freed: typeof state.freed === "number" ? state.freed : 0,
    errs: Array.isArray(state.errs) ? state.errs.slice() : []
  };
}

function findEntry(state, path) {
  for (const pair of state.entries) {
    if (pair[0] === path) {
      return pair;
    }
  }
  return null;
}

function parentPath(path) {
  const segments = splitPath(path);
  if (segments.length <= 1) {
    return "/";
  }
  return joinPath(segments.slice(0, -1));
}

function nextId(state) {
  let id = 1;
  while (state.nodes[String(id)]) {
    id += 1;
  }
  return id;
}

function sortEntries(state) {
  state.entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

function createNode(state, path, kind) {
  splitPath(path);
  if (findEntry(state, path)) {
    fail("E_EXISTS");
  }
  const parent = parentPath(path);
  const parentEntry = findEntry(state, parent);
  if (!parentEntry) {
    fail("E_NO_PATH");
  }
  if (state.nodes[String(parentEntry[1])].kind !== "dir") {
    fail("E_NOT_DIR");
  }
  const next = cloneState(state);
  const id = nextId(next);
  next.entries.push([path, id]);
  next.nodes[String(id)] = { kind: kind, links: 1 };
  sortEntries(next);
  return next;
}

export function makeDir(state, path) {
  const next = createNode(state, path, "dir");
  next.counts.mkdir += 1;
  return next;
}

export function makeFile(state, path) {
  const next = createNode(state, path, "file");
  next.counts.create += 1;
  return next;
}

export function makeLink(state, from, to) {
  splitPath(from);
  splitPath(to);
  const source = findEntry(state, from);
  if (!source) {
    fail("E_NO_PATH");
  }
  if (state.nodes[String(source[1])].kind === "dir") {
    fail("E_LINK_DIR");
  }
  if (findEntry(state, to)) {
    fail("E_EXISTS");
  }
  const parent = parentPath(to);
  const parentEntry = findEntry(state, parent);
  if (!parentEntry) {
    fail("E_NO_PATH");
  }
  if (state.nodes[String(parentEntry[1])].kind !== "dir") {
    fail("E_NOT_DIR");
  }
  const next = cloneState(state);
  const target = findEntry(next, from);
  next.entries.push([to, target[1]]);
  next.nodes[String(target[1])].links += 1;
  sortEntries(next);
  next.counts.link += 1;
  return next;
}

export function dropPath(state, path) {
  splitPath(path);
  if (path === "/") {
    fail("E_ROOT");
  }
  const entry = findEntry(state, path);
  if (!entry) {
    fail("E_NO_PATH");
  }
  if (state.nodes[String(entry[1])].kind === "dir") {
    const prefix = path + "/";
    for (const pair of state.entries) {
      if (pair[0].indexOf(prefix) === 0) {
        fail("E_DIR_NOT_EMPTY");
      }
    }
  }
  const next = cloneState(state);
  const victim = findEntry(next, path);
  next.entries = next.entries.filter((pair) => pair[0] !== path);
  const node = next.nodes[String(victim[1])];
  node.links -= 1;
  if (node.links <= 0) {
    delete next.nodes[String(victim[1])];
    next.freed += 1;
  }
  next.counts.drop += 1;
  return next;
}

export function movePath(state, from, to) {
  splitPath(from);
  splitPath(to);
  if (!findEntry(state, from)) {
    fail("E_NO_PATH");
  }
  if (from === to) {
    fail("E_SAME");
  }
  if (from === "/" || to === "/") {
    fail("E_ROOT");
  }
  if (findEntry(state, to)) {
    fail("E_EXISTS");
  }
  const parent = parentPath(to);
  const parentEntry = findEntry(state, parent);
  if (!parentEntry) {
    fail("E_NO_PATH");
  }
  if (state.nodes[String(parentEntry[1])].kind !== "dir") {
    fail("E_NOT_DIR");
  }
  if (to === from || to.indexOf(from + "/") === 0) {
    fail("E_CYCLE");
  }
  const next = cloneState(state);
  next.entries = next.entries.map((pair) => [rebasePath(pair[0], from, to), pair[1]]);
  sortEntries(next);
  next.counts.move += 1;
  return next;
}

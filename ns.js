// ns.js：路径校验、拼接、深度与前缀改写
function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

export function splitPath(path) {
  if (typeof path !== "string" || path === "" || path[0] !== "/") {
    fail("E_BAD_PATH");
  }
  if (path === "/") {
    return [];
  }
  if (path[path.length - 1] === "/" || path.indexOf("//") !== -1) {
    fail("E_BAD_PATH");
  }
  const segments = path.slice(1).split("/");
  for (const segment of segments) {
    if (segment === "" || segment === "." || segment === "..") {
      fail("E_BAD_PATH");
    }
  }
  return segments;
}

export function joinPath(segments) {
  const list = Array.from(segments || []);
  if (list.length === 0) {
    return "/";
  }
  return "/" + list.join("/");
}

export function pathDepth(path) {
  return splitPath(path).length;
}

export function rebasePath(path, from, to) {
  if (path === from) {
    return to;
  }
  if (path.indexOf(from + "/") === 0) {
    return to + path.slice(from.length);
  }
  return path;
}

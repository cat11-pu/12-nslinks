import fs from "node:fs";
import { splitPath, joinPath, pathDepth, rebasePath } from "./ns.js";
import { makeDir, makeFile, makeLink, dropPath, movePath } from "./ops.js";
import { render } from "./app.js";

const __lines = [];
function emit(label, value) {
  __lines.push([String(label).replace(/ =$/, ""), value]);
}

const spec = JSON.parse(fs.readFileSync(process.argv[2] || "sample/scene.json", "utf8"));
const view = render(spec);

emit("条目表", view.entries);
emit("节点表（编号、kind、links 升序）", view.node_table);
emit("最高深度", view.max_depth);
emit("空目录数", view.empty_dirs);
emit("五类成功计数（按事件顺序）", [view.counts.mkdir, view.counts.create, view.counts.link, view.counts.drop, view.counts.move]);
emit("释放编号数", view.freed);
emit("下一个编号", view.next_id);
emit("多链接文件数", view.multi_link);
emit("硬链接数一致", view.links_ok);
emit("无悬空无孤儿", view.no_orphan);
emit("条目表有序无重复", view.ordered);
emit("重放不新增", view.replay_new);
emit("重放异常条数", view.replay_failed);
emit("拆两轮中间态不同", view.mid_differs);
emit("拆两轮收尾态一致", view.split_equal);
emit("异常事件数", view.failed);

// ---- 错误路径探针：真调用实现，看它报出什么码 ----
try {
  makeDir(spec.state, "rel/x");
  emit("坏路径报码", "没有报错");
} catch (error) {
  emit("坏路径报码", error && error.code ? error.code : String(error.message));
}
try {
  const held = makeFile(spec.state, "/z");
  makeFile(held, "/z");
  emit("重复创建报码", "没有报错");
} catch (error) {
  emit("重复创建报码", error && error.code ? error.code : String(error.message));
}
try {
  dropPath(spec.state, "/nope");
  emit("删除缺失报码", "没有报错");
} catch (error) {
  emit("删除缺失报码", error && error.code ? error.code : String(error.message));
}
try {
  dropPath(spec.state, "/");
  emit("删除根报码", "没有报错");
} catch (error) {
  emit("删除根报码", error && error.code ? error.code : String(error.message));
}
try {
  let chain = makeDir(spec.state, "/p1");
  chain = makeDir(chain, "/p1/inner");
  movePath(chain, "/p1", "/p1/inner/deep");
  emit("重命名成环报码", "没有报错");
} catch (error) {
  emit("重命名成环报码", error && error.code ? error.code : String(error.message));
}
try {
  const held = makeDir(spec.state, "/p2");
  movePath(held, "/p2", "/p2");
  emit("重命名同名报码", "没有报错");
} catch (error) {
  emit("重命名同名报码", error && error.code ? error.code : String(error.message));
}
try {
  const held = makeDir(spec.state, "/p3");
  makeLink(held, "/p3", "/p3link");
  emit("给目录建链接报码", "没有报错");
} catch (error) {
  emit("给目录建链接报码", error && error.code ? error.code : String(error.message));
}

// ---- 期望值（参考模型算出）----
const EXPECTED = {
  "条目表": [
    [
      "/",
      1
    ],
    [
      "/a2",
      2
    ],
    [
      "/a2/f2",
      7
    ],
    [
      "/b",
      4
    ],
    [
      "/b/g2",
      5
    ],
    [
      "/b/g2/f2.link",
      7
    ],
    [
      "/b/g2/h",
      6
    ],
    [
      "/b/g2/k",
      3
    ],
    [
      "/b/s",
      8
    ]
  ],
  "节点表（编号、kind、links 升序）": [
    [
      1,
      "dir",
      1
    ],
    [
      2,
      "dir",
      1
    ],
    [
      3,
      "file",
      1
    ],
    [
      4,
      "dir",
      1
    ],
    [
      5,
      "dir",
      1
    ],
    [
      6,
      "file",
      1
    ],
    [
      7,
      "file",
      2
    ],
    [
      8,
      "dir",
      1
    ]
  ],
  "最高深度": 3,
  "空目录数": 1,
  "五类成功计数（按事件顺序）": [
    5,
    4,
    2,
    3,
    2
  ],
  "释放编号数": 2,
  "下一个编号": 9,
  "多链接文件数": 1,
  "硬链接数一致": true,
  "无悬空无孤儿": true,
  "条目表有序无重复": true,
  "重放不新增": 0,
  "重放异常条数": 8,
  "拆两轮中间态不同": true,
  "拆两轮收尾态一致": true,
  "异常事件数": 8,
  "坏路径报码": "E_BAD_PATH",
  "重复创建报码": "E_EXISTS",
  "删除缺失报码": "E_NO_PATH",
  "删除根报码": "E_ROOT",
  "重命名成环报码": "E_CYCLE",
  "重命名同名报码": "E_SAME",
  "给目录建链接报码": "E_LINK_DIR"
};
function __same(got, want) {
  if (typeof got === "string") {
    try { const parsed = JSON.parse(got); if (JSON.stringify(parsed) === JSON.stringify(want)) return true; } catch (error) { }
  }
  return JSON.stringify(got) === JSON.stringify(want);
}
let __bad = 0;
for (const [label, want] of Object.entries(EXPECTED)) {
  const found = __lines.find((pair) => pair[0] === label);
  if (!found) { __bad += 1; console.log("缺失验收项 " + label); continue; }
  if (__same(found[1], want)) { console.log("一致 " + label + " = " + JSON.stringify(found[1])); }
  else { __bad += 1; console.log("不一致 " + label + " 期望 " + JSON.stringify(want) + " 实际 " + JSON.stringify(found[1])); }
}
console.log("验收项 " + (Object.keys(EXPECTED).length - __bad) + "/" + Object.keys(EXPECTED).length + " 通过");
process.exit(__bad === 0 ? 0 : 1);

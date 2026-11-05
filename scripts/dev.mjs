import { spawn } from "node:child_process";
const major = Number(process.versions.node.split(".")[0]);
if (major < 24) {
  console.error("Kërkohet Node.js 24 ose më i ri.");
  process.exit(1);
}
// Local development has one fixed frontend URL, regardless of old .env values.
process.env.APP_URL = "http://localhost:5173";
process.env.PORT = "3001";
console.log("Hap HotelFlow: http://localhost:5173");
const children = [
  spawn(process.execPath, ["--env-file-if-exists=.env", "server/index.ts"], {
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "development" },
  }),
  spawn(
    process.execPath,
    ["node_modules/vite/bin/vite.js", ...process.argv.slice(2)],
    { stdio: "inherit" },
  ),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exit(code);
}
for (const child of children) {
  child.on("error", (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on("exit", (code) => {
    if (!stopping) stop(code || 0);
  });
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());

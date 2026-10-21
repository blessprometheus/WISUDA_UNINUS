// Bangun frontend persis dengan mode production Next.js dan API dari TypeScript terkompilasi.
import { spawnSync } from "node:child_process";

const steps = [
  ["API", ["node_modules/typescript/bin/tsc", "-p", "server/tsconfig.json"]],
  ["Situs", ["node_modules/next/dist/bin/next", "build", "--webpack"]],
];

for (const [label, args] of steps) {
  console.log(`Membangun ${label}…`);
  const result = spawnSync(process.execPath, args, {
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "production" },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

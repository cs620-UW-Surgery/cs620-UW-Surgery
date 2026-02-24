import fs from 'fs';
import path from 'path';
import net from 'net';
import { spawnSync } from 'child_process';

const root = process.cwd();
const envPath = path.join(root, '.env');
const examplePath = path.join(root, '.env.example');
const composePath = path.join(root, 'docker-compose.yml');

function parseEnvFile(content: string) {
  const env: Record<string, string> = {};
  content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .forEach((line) => {
      const [key, ...rest] = line.split('=');
      if (!key) return;
      const raw = rest.join('=').trim();
      const cleaned = raw.replace(/^"|"$/g, '').replace(/^'|'$/g, '');
      env[key] = cleaned;
    });
  return env;
}

function run(command: string, args: string[], extraEnv?: Record<string, string>) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv }
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function commandExists(command: string, args: string[]) {
  const result = spawnSync(command, args, { stdio: 'ignore' });
  return result.status === 0;
}

async function waitForPort(host: string, port: number, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise<void>((resolve, reject) => {
    const tryConnect = () => {
      const socket = net.createConnection({ host, port });
      socket.on('connect', () => {
        socket.end();
        resolve();
      });
      socket.on('error', () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error('Timed out waiting for database'));
          return;
        }
        setTimeout(tryConnect, 1000);
      });
    };
    tryConnect();
  });
}

function extractDbHostPort(databaseUrl: string) {
  try {
    const url = new URL(databaseUrl);
    return { host: url.hostname, port: Number(url.port || 5432) };
  } catch {
    return null;
  }
}

async function main() {
  if (!fs.existsSync(envPath)) {
    if (fs.existsSync(examplePath)) {
      fs.copyFileSync(examplePath, envPath);
    }
    console.log('Created .env from .env.example. Please fill in the values, then re-run `pnpm demo`.');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf-8');
  const env = parseEnvFile(envContent);

  const requiredKeys = ['DATABASE_URL'];
  const missing = requiredKeys.filter((key) => !env[key]);
  if (missing.length > 0) {
    console.log(`Missing required env vars in .env: ${missing.join(', ')}`);
    process.exit(1);
  }

  if (!env.OPENAI_API_KEY) {
    console.log('OPENAI_API_KEY not set. The app will run in fallback mode without model calls.');
  }

  if (fs.existsSync(composePath) && commandExists('docker', ['compose', 'version'])) {
    console.log('Starting local Postgres via Docker...');
    run('docker', ['compose', 'up', '-d']);
  } else {
    console.log('Docker not available. Ensure Postgres is running and DATABASE_URL is correct.');
  }

  const dbTarget = extractDbHostPort(env.DATABASE_URL);
  if (dbTarget) {
    console.log('Waiting for database to be ready...');
    try {
      await waitForPort(dbTarget.host, dbTarget.port);
    } catch (error) {
      console.error('Database did not become ready in time.');
      process.exit(1);
    }
  }

  run('pnpm', ['prisma:generate'], env);
  run('pnpm', ['prisma:migrate'], env);

  if (process.env.RUN_INGEST === '1') {
    run('pnpm', ['ingest'], env);
  }

  console.log('Starting dev server at http://localhost:3000');
  run('pnpm', ['dev'], env);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

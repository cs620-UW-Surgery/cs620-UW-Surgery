#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const port = process.env.PORT || '3000';
const host = process.env.HOST || '0.0.0.0';
const noTunnel = process.env.NO_TUNNEL === '1' || process.env.NO_TUNNEL === 'true';
const root = process.cwd();
const linkFile = path.join(root, 'share-link.txt');

const children = new Set();
let shuttingDown = false;

function registerChild(child) {
  children.add(child);
  child.on('exit', () => children.delete(child));
}

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    try {
      child.kill(signal);
    } catch {
      // ignore
    }
  }
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

const nextDev = spawn(
  'pnpm',
  ['exec', 'next', 'dev', '-H', host, '-p', port],
  { stdio: 'inherit' }
);
registerChild(nextDev);

nextDev.on('exit', (code) => {
  if (!shuttingDown) process.exit(code ?? 0);
});

if (!noTunnel) {
  const tunnel = spawn(
    'pnpm',
    ['dlx', 'localtunnel', '--port', port],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );
  registerChild(tunnel);

  let linkWritten = false;
  const onData = (data) => {
    const text = data.toString();
    process.stdout.write(text);

    if (!linkWritten) {
      const match = text.match(/https?:\/\/\S+/);
      if (match) {
        const url = match[0].trim();
        linkWritten = true;
        try {
          fs.writeFileSync(linkFile, `${url}\n`, 'utf8');
          console.log(`\nShare link saved to ${path.relative(root, linkFile)}: ${url}`);
        } catch (err) {
          console.error(`\nShare link (could not write to file): ${url}`);
          console.error(String(err));
        }
      }
    }
  };

  tunnel.stdout.on('data', onData);
  tunnel.stderr.on('data', onData);

  tunnel.on('exit', (code) => {
    if (code && !shuttingDown) {
      console.error(`\nTunnel exited with code ${code}. Dev server is still running.`);
      console.error('If you only want local dev, set NO_TUNNEL=1.');
    }
  });
}

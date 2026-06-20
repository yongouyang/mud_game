const net = require('net');

const PREFERRED = 5173;
const FALLBACK_START = 5174;
const MAX_ATTEMPTS = 100;

function isPortInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect(port, '127.0.0.1');
    socket.setTimeout(500);
    socket.once('connect', () => {
      socket.end();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function main() {
  if (!(await isPortInUse(PREFERRED))) {
    console.log(String(PREFERRED));
    return;
  }

  for (let port = FALLBACK_START; port < FALLBACK_START + MAX_ATTEMPTS; port++) {
    if (!(await isPortInUse(port))) {
      console.log(String(port));
      return;
    }
  }

  console.error(`Could not find an available port between ${FALLBACK_START} and ${FALLBACK_START + MAX_ATTEMPTS - 1}`);
  process.exit(1);
}

main();

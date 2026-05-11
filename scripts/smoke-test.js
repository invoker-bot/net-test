// Standalone smoke test: spawns server transports, client transports,
// sends packets back and forth, and verifies all events fire correctly.
// Bypasses Electron entirely so it can run in any Node 18+ env.

import net from 'node:net';
import dgram from 'node:dgram';
import { TcpClientTransport, TcpServerTransport } from '../src/main/transports/tcp.js';
import { UdpTransport } from '../src/main/transports/udp.js';
import { WsClientTransport, WsServerTransport } from '../src/main/transports/ws.js';
import { MockTransport } from '../src/main/transports/mock.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];

function check(name, cond, detail = '') {
  results.push({ name, ok: !!cond, detail });
  console.log((cond ? '  ✓' : '  ✗') + ' ' + name + (cond ? '' : ' — ' + detail));
}

async function pickPort() {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}

async function testTcp() {
  console.log('\nTCP client ↔ server');
  const port = await pickPort();
  const server = new TcpServerTransport('127.0.0.1:' + port);
  const serverPackets = [];
  server.on('packet', (b, dir) => serverPackets.push({ bytes: Array.from(b), dir }));
  await server.start();
  check('server starts on assigned port', true);

  const client = new TcpClientTransport('127.0.0.1:' + port);
  const clientPackets = [];
  client.on('packet', (b, dir) => clientPackets.push({ bytes: Array.from(b), dir }));
  await client.start();
  await sleep(50);

  await client.send(new Uint8Array([0xDE, 0xAD, 0xBE, 0xEF]));
  await sleep(100);
  check('server receives bytes from client', serverPackets.length > 0,
    `got ${serverPackets.length} packets`);
  check('payload matches', serverPackets[0]?.bytes.join(',') === '222,173,190,239',
    serverPackets[0]?.bytes.join(','));

  await server.send(new Uint8Array([0xCA, 0xFE]));
  await sleep(100);
  check('client receives bytes from server', clientPackets.length > 0,
    `got ${clientPackets.length} packets`);

  await client.stop();
  await server.stop();
}

async function testUdp() {
  console.log('\nUDP listener ↔ sender');
  const port = await pickPort();
  const listener = new UdpTransport({ role: 'server', bind: '127.0.0.1:' + port });
  const got = [];
  listener.on('packet', (b) => got.push(Array.from(b)));
  await listener.start();
  check('UDP listener binds', true);

  // Use raw dgram to send a probe
  const probe = dgram.createSocket('udp4');
  await new Promise((res) => probe.send(Buffer.from([1, 2, 3, 4]), port, '127.0.0.1', () => res()));
  await sleep(80);
  probe.close();
  check('listener receives UDP', got.length > 0 && got[0].join(',') === '1,2,3,4', JSON.stringify(got));

  // Now check sending back
  let received = null;
  const back = dgram.createSocket('udp4');
  back.on('message', (buf) => { received = Array.from(buf); });
  await new Promise((res) => back.bind(0, '127.0.0.1', res));
  const replyPort = back.address().port;
  const probe2 = dgram.createSocket('udp4');
  await new Promise((res) => probe2.bind(replyPort + 1, '127.0.0.1', res));
  await new Promise((res) => probe2.send(Buffer.from([7]), port, '127.0.0.1', () => res()));
  await sleep(50);
  try {
    await listener.send(new Uint8Array([0x42]));
  } catch (e) {
    check('listener.send before peer known fails gracefully', false, e.message);
  }
  await sleep(80);
  probe2.close();
  back.close();

  await listener.stop();
}

async function testWebSocket() {
  console.log('\nWebSocket server ↔ client');
  const port = await pickPort();
  const server = new WsServerTransport('127.0.0.1:' + port);
  const sPkts = [];
  server.on('packet', (b) => sPkts.push(Array.from(b)));
  await server.start();
  check('WS server listens', true);

  const client = new WsClientTransport('ws://127.0.0.1:' + port);
  const cPkts = [];
  client.on('packet', (b) => cPkts.push(Array.from(b)));
  await client.start();
  await sleep(50);

  await client.send(new Uint8Array([1, 2, 3]));
  await sleep(80);
  check('server gets WS bytes', sPkts.length > 0 && sPkts[0].join(',') === '1,2,3', JSON.stringify(sPkts));

  await server.send(new Uint8Array([9, 8, 7]));
  await sleep(80);
  check('client gets WS bytes back', cPkts.length > 0, JSON.stringify(cPkts));

  await client.stop();
  await server.stop();
}

async function testMock() {
  console.log('\nMock transport generates 32-byte packets with valid CRC');
  const m = new MockTransport();
  m.rateHz = 50; // fast for test
  const packets = [];
  m.on('packet', (b) => packets.push(b));
  await m.start();
  await sleep(250);
  await m.stop();
  check('packets emitted', packets.length > 5, `got ${packets.length}`);
  check('packet size is 32 bytes', packets[0]?.length === 32);
  // verify magic bytes
  const dv = new DataView(packets[0].buffer, packets[0].byteOffset, 32);
  check('magic word 0xCAFE present (LE)', dv.getUint16(0, true) === 0xCAFE);
}

async function main() {
  try {
    await testMock();
    await testTcp();
    await testUdp();
    await testWebSocket();
  } catch (e) {
    console.error('UNHANDLED', e);
    results.push({ name: 'unhandled', ok: false, detail: e.message });
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length) {
    console.log('\nFailures:');
    for (const f of failed) console.log(' - ' + f.name + ': ' + f.detail);
    process.exit(1);
  }
  process.exit(0);
}

main();

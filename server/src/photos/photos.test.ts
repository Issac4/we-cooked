import http from 'node:http';
import type { AddressInfo } from 'node:net';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fetchImage, isPublicAddress } from './fetch-image.js';

describe('isPublicAddress', () => {
  it.each([
    ['8.8.8.8', true],
    ['142.250.72.14', true],
    ['2606:4700::6810:85e5', true],
    ['127.0.0.1', false],
    ['10.1.2.3', false],
    ['172.16.0.1', false],
    ['172.31.255.255', false],
    ['192.168.2.108', false],
    ['169.254.169.254', false],
    ['100.64.0.1', false],
    ['0.0.0.0', false],
    ['224.0.0.1', false],
    ['::1', false],
    ['::', false],
    ['fd00::1', false],
    ['fe80::1', false],
    ['::ffff:192.168.1.1', false],
    ['::ffff:8.8.8.8', true],
    ['not-an-ip', false],
  ])('%s → %s', (ip, expected) => {
    expect(isPublicAddress(ip)).toBe(expected);
  });
});

describe('fetchImage refuses anything that is not a public web address', () => {
  let server: http.Server;
  let port = 0;
  beforeAll(async () => {
    const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#fff' } }).png().toBuffer();
    server = http.createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'image/png' });
      res.end(png);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it.each([
    () => `http://127.0.0.1:${port}/photo.png`,
    () => `http://localhost:${port}/photo.png`,
    () => 'http://192.168.2.108/photo.png',
    () => 'http://169.254.169.254/latest/meta-data/',
    () => 'http://[::1]/photo.png',
    () => 'file:///etc/passwd',
    () => 'ftp://example.com/photo.png',
    () => 'http://user:pass@example.com/photo.png',
    () => 'not a link',
  ])('refuses %#', async (make) => {
    await expect(fetchImage(make())).rejects.toMatchObject({ status: 400 });
  });

  it('says why a local address is refused', async () => {
    await expect(fetchImage(`http://localhost:${port}/photo.png`)).rejects.toThrow(/private or local address/);
  });
});

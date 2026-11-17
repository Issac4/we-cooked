import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { HttpError } from '../http.js';
import { MAX_UPLOAD_BYTES } from '../routes/uploads.js';

const TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;

function v4Public(ip: string): boolean {
  const [a = 0, b = 0, c = 0] = ip.split('.').map(Number);
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false; // this-network, private, loopback, multicast/reserved
  if (a === 100 && b >= 64 && b <= 127) return false; // carrier-grade NAT
  if (a === 169 && b === 254) return false; // link-local (incl. cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false;
  if (a === 198 && (b === 18 || b === 19)) return false; // benchmarking
  if (a === 198 && b === 51 && c === 100) return false; // documentation
  if (a === 203 && b === 0 && c === 113) return false; // documentation
  return true;
}

/** True only for addresses on the public internet (not the home network, the server itself, or reserved ranges). */
export function isPublicAddress(ip: string): boolean {
  if (net.isIPv4(ip)) return v4Public(ip);
  if (!net.isIPv6(ip)) return false;
  const lower = ip.toLowerCase();
  const mapped = lower.match(/^(?:::ffff:|64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return v4Public(mapped[1]!);
  if (lower === '::' || lower === '::1') return false;
  const first = parseInt(lower.split(':')[0] || '0', 16);
  if ((first & 0xfe00) === 0xfc00) return false; // unique local fc00::/7
  if ((first & 0xffc0) === 0xfe80) return false; // link-local fe80::/10
  if ((first & 0xff00) === 0xff00) return false; // multicast
  if (lower.startsWith('2001:db8:') || lower.startsWith('2001:0db8:')) return false; // documentation
  return true;
}

/**
 * DNS lookup used for the actual connection, so a name that resolves to a
 * private address is refused at connect time (no "check, then re-resolve" gap).
 */
const safeLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { all: true, family: options.family }, (err, addresses) => {
    if (err) return callback(err, '', 4);
    const list = addresses as dns.LookupAddress[];
    if (!list.length || list.some((a) => !isPublicAddress(a.address))) {
      return callback(Object.assign(new Error('blocked address'), { code: 'EBLOCKED' }), '', 4);
    }
    if (options.all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
    callback(null, list[0]!.address, list[0]!.family);
  });
};

function getOnce(url: URL): Promise<{ status: number; location?: string; type: string; body?: Buffer }> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    const req = client.get(
      url,
      { lookup: safeLookup, timeout: TIMEOUT_MS, headers: { 'User-Agent': 'WeCooked/2 (recipe photo)', Accept: 'image/*' } },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          res.resume();
          return resolve({ status, location: res.headers.location, type: '' });
        }
        if (status !== 200) {
          res.resume();
          return resolve({ status, type: '' });
        }
        const declared = Number(res.headers['content-length'] ?? 0);
        if (declared > MAX_UPLOAD_BYTES) {
          res.destroy();
          return reject(new HttpError(400, 'That photo is larger than 15 MB'));
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_UPLOAD_BYTES) {
            res.destroy();
            reject(new HttpError(400, 'That photo is larger than 15 MB'));
          } else chunks.push(chunk);
        });
        res.on('end', () => resolve({ status, type: String(res.headers['content-type'] ?? ''), body: Buffer.concat(chunks) }));
        res.on('error', reject);
      },
    );
    req.on('timeout', () => req.destroy(new HttpError(400, 'The photo link took too long to answer')));
    req.on('error', (err: NodeJS.ErrnoException) => {
      if (err instanceof HttpError) return reject(err);
      if (err.code === 'EBLOCKED') return reject(new HttpError(400, 'That link points to a private or local address, which is not allowed'));
      reject(new HttpError(400, `Could not download the photo (${err.code ?? err.message})`));
    });
  });
}

/** Downloads an image from a public http(s) link, following at most 3 redirects. */
export async function fetchImage(link: string): Promise<Buffer> {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    throw new HttpError(400, 'That is not a valid link');
  }
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new HttpError(400, 'Only http and https links are allowed');
    if (url.username || url.password) throw new HttpError(400, 'Links with a username or password are not allowed');
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (net.isIP(host) && !isPublicAddress(host)) throw new HttpError(400, 'That link points to a private or local address, which is not allowed');

    const res = await getOnce(url);
    if (res.location) {
      url = new URL(res.location, url);
      continue;
    }
    if (!res.body) throw new HttpError(400, `The photo link answered with status ${res.status}`);
    return res.body;
  }
  throw new HttpError(400, 'The photo link redirected too many times');
}

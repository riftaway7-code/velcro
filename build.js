import { cpSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = dirname(fileURLToPath(import.meta.url));
const nm = join(root, 'node_modules');
const pub = join(root, 'public');

const copies = [
  ['@mercuryworkshop/scramjet/dist', 'scramjet'],
  ['@mercuryworkshop/bare-mux/dist', 'bare-mux'],
  ['@mercuryworkshop/epoxy-transport/dist', 'epoxy'],
  ['@titaniumnetwork-dev/ultraviolet/dist', 'uv'],
];

for (const [src, dest] of copies) {
  const target = join(pub, dest);
  mkdirSync(target, { recursive: true });
  cpSync(join(nm, src), target, { recursive: true, force: true });
  console.log(`Copied ${src} -> public/${dest}`);
}

writeFileSync(
  join(pub, 'uv', 'uv.config.js'),
  `self.__uv$config = {\n  prefix: "/uv/service/",\n  encodeUrl: Ultraviolet.codec.xor.encode,\n  decodeUrl: Ultraviolet.codec.xor.decode,\n  handler: "/uv/uv.handler.js",\n  client: "/uv/uv.client.js",\n  bundle: "/uv/uv.bundle.js",\n  config: "/uv/uv.config.js",\n  sw: "/uv/uv.sw.js",\n};\n`
);
console.log('Wrote public/uv/uv.config.js');

console.log('Build complete.');

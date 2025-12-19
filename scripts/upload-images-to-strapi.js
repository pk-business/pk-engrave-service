const fs = require('fs');
const path = require('path');

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;
const args = process.argv.slice(2);
const localDirArgIndex = args.findIndex(a => a === '--local-dir');
const LOCAL_DIR = localDirArgIndex !== -1 ? args[localDirArgIndex + 1] : null;

function readDB() {
  const p = path.resolve(process.cwd(), 'db.json');
  if (!fs.existsSync(p)) throw new Error('db.json not found at ' + p);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function gatherImageUrls(product) {
  const imgs = [];
  if (Array.isArray(product.images) && product.images.length) {
    product.images.forEach(i => { if (i) imgs.push(i); });
  }
  if (product.imageUrl && !imgs.includes(product.imageUrl)) imgs.push(product.imageUrl);
  return imgs;
}

function listLocalImages(dir) {
  if (!dir) return [];
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter(f => {
    const ext = path.extname(f).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'].includes(ext);
  });
  return files.map(f => ({ filename: f, path: path.join(dir, f) }));
}

function normalizeName(s) {
  return (s || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findLocalMatchesForProduct(product, localFiles) {
  if (!localFiles || localFiles.length === 0) return [];
  const pname = normalizeName(product.name || product.title || '');
  // match files where normalized filename contains product name or vice versa
  return localFiles.filter(f => {
    const base = path.basename(f.filename, path.extname(f.filename));
    const n = normalizeName(base);
    return n.includes(pname) || pname.includes(n);
  });
}

async function fetchStrapiProductByName(name) {
  const url = `${STRAPI_URL}/api/products?filters[name][$eq]=${encodeURIComponent(name)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` } });
  if (!res.ok) return null;
  const json = await res.json();
  if (!json || !json.data || json.data.length === 0) return null;
  return json.data[0];
}

async function uploadRemoteImageToStrapi(imageUrl) {
  // download remote image
  const r = await fetch(imageUrl);
  if (!r.ok) throw new Error(`Failed to fetch ${imageUrl}: ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const filename = path.basename(new URL(imageUrl).pathname) || 'image.jpg';

  const formData = new FormData();
  const fileBlob = new Blob([buf]);
  formData.append('files', fileBlob, filename);

  const res = await fetch(`${STRAPI_URL}/api/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
    },
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed ${res.status}: ${text}`);
  }
  const json = await res.json();
  // Strapi returns an array of uploaded file objects
  return json && json[0] ? json[0] : null;
}

async function patchProductGallery(productId, mediaIds) {
  const url = `${STRAPI_URL}/api/products/${productId}`;
  const body = { data: { gallery: mediaIds } };
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Patch product failed ${res.status}: ${text}`);
  }
  return await res.json();
}

async function main() {
  const dryRun = process.argv.includes('--dry-run') || !STRAPI_API_TOKEN;
  const db = readDB();
  const products = db.products || [];
  console.log(`Found ${products.length} products in db.json`);

  for (const p of products) {
    const images = gatherImageUrls(p);
    if (!images.length) continue;
    console.log(`\nProduct: ${p.name} — ${images.length} image(s)`);
    if (dryRun) {
      images.forEach((u, i) => console.log(`  [dry] ${i + 1}: ${u}`));
      continue;
    }

    // find product in Strapi
    const sp = await fetchStrapiProductByName(p.name);
    if (!sp) {
      console.warn(`  Skipping — product not found in Strapi: ${p.name}`);
      continue;
    }
    const productId = sp.id;

    const uploadedIds = [];
    for (const url of images) {
      try {
        console.log(`  Uploading ${url} ...`);
        const uploaded = await uploadRemoteImageToStrapi(url);
        if (uploaded && uploaded.id) {
          console.log(`    uploaded id=${uploaded.id}`);
          uploadedIds.push(uploaded.id);
        } else {
          console.warn('    upload returned no id');
        }
      } catch (err) {
        console.error('    upload error:', err.message || err);
      }
    }

    if (uploadedIds.length) {
      console.log(`  Patching product ${productId} gallery with ids: ${uploadedIds.join(',')}`);
      await patchProductGallery(productId, uploadedIds.map(id => ({ id })));
      console.log('  Patched');
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

#!/usr/bin/env node
/*
  Import data into Strapi from a JSON file.

  Usage:
    STRAPI_API_TOKEN=your_token STRAPI_URL=http://localhost:1337 node ./scripts/import-to-strapi.js ./data/db.json

  The JSON should be an object with keys like `materials`, `occasions`, `categories`, `products`.
  Each key should be an array of objects. Products may reference relations by name
  (e.g. product.material = "Wood", product.categories = ["Rings", "Gifts"]).
  The script will create materials/occasions/categories first, map names->ids, then create products.
*/

const fs = require('fs').promises;
const path = require('path');

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const API_TOKEN = process.env.STRAPI_API_TOKEN;

if (!API_TOKEN) {
  console.error('ERROR: Please set STRAPI_API_TOKEN environment variable.');
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${API_TOKEN}`,
};

async function apiPost(collection, payload) {
  const url = `${STRAPI_URL}/api/${collection}`;
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ data: payload }) });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${url} failed: ${res.status} ${res.statusText} - ${text}`);
  }
  return res.json();
}

async function apiGet(collection, filters = {}) {
  const qs = new URLSearchParams(Object.entries(filters)).toString();
  const url = `${STRAPI_URL}/api/${collection}${qs ? `?${qs}` : ''}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return res.json();
}

async function ensureEntries(collection, items, key = 'name') {
  const map = new Map();
  for (const item of items) {
    const name = typeof item === 'string' ? item : item[key];
    if (!name) continue;
    // Try to find existing by name
    try {
      const found = await apiGet(collection, { ['filters[' + key + '][$eq]']: name });
      const data = found?.data?.[0];
      if (data) {
        map.set(name, data.id);
        continue;
      }
    } catch (e) {
      // ignore and attempt create
    }

    const payload = typeof item === 'string' ? { [key]: item } : { ...item };
    try {
      const created = await apiPost(collection, payload);
      const id = created?.data?.id;
      if (id) map.set(name, id);
      console.log(`Created ${collection} ${name} (id ${id})`);
    } catch (err) {
      console.error(`Failed to create ${collection} ${name}:`, err.message);
    }
  }
  return map;
}

function normalizeArrayField(v) {
  if (v == null) return [];
  if (Array.isArray(v)) return v;
  return [v];
}

async function main() {
  const argPath = process.argv[2] || './data/db.json';
  const filePath = path.resolve(process.cwd(), argPath);
  let raw;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch (e) {
    console.error(`Cannot read file ${filePath}:`, e.message);
    process.exit(1);
  }

  let db;
  try {
    db = JSON.parse(raw);
  } catch (e) {
    console.error('Invalid JSON:', e.message);
    process.exit(1);
  }

  let materials = db.materials || db.Materials || [];
  let occasions = db.occasions || db.Occasions || [];
  let categories = db.categories || db.Categories || [];
  const products = db.products || db.Products || [];

  // If top-level lists are missing, derive them from products
  if ((!materials || materials.length === 0) && products.length) {
    const set = new Set();
    for (const p of products) if (p.material) set.add(p.material);
    materials = Array.from(set).map(name => ({ name }));
  }
  if ((!occasions || occasions.length === 0) && products.length) {
    const set = new Set();
    for (const p of products) if (p.occasions) for (const o of p.occasions) set.add(o);
    occasions = Array.from(set).map(name => ({ name }));
  }
  if ((!categories || categories.length === 0) && products.length) {
    const set = new Set();
    for (const p of products) if (p.categories) for (const c of p.categories) set.add(c);
    categories = Array.from(set).map(name => ({ name }));
  }

  console.log(`Found: materials=${materials.length}, occasions=${occasions.length}, categories=${categories.length}, products=${products.length}`);

  const materialMap = await ensureEntries('materials', materials);
  const occasionMap = await ensureEntries('occasions', occasions);
  const categoryMap = await ensureEntries('categories', categories);

  // Create products
  for (const p of products) {
    const payload = { ...p };

    // Map simple relation fields by name to ids
    if (p.material) {
      const mName = typeof p.material === 'string' ? p.material : p.material.name || p.material;
      const mid = materialMap.get(mName);
      if (mid) payload.material = mid;
      else delete payload.material;
    }

    if (p.occasions) {
      const occNames = normalizeArrayField(p.occasions).map(o => (typeof o === 'string' ? o : o.name || o));
      const occIds = occNames.map(n => occasionMap.get(n)).filter(Boolean);
      if (occIds.length) payload.occasions = occIds;
      else delete payload.occasions;
    }

    if (p.categories) {
      const catNames = normalizeArrayField(p.categories).map(c => (typeof c === 'string' ? c : c.name || c));
      const catIds = catNames.map(n => categoryMap.get(n)).filter(Boolean);
      if (catIds.length) payload.categories = catIds;
      else delete payload.categories;
    }

    // Remove id if present in payload
    delete payload.id;

    // Map source 'images' array to imageUrl if imageUrl missing, then remove 'images'
    if (p.images && Array.isArray(p.images) && p.images.length) {
      if (!payload.imageUrl) payload.imageUrl = p.images[0];
      delete payload.images;
    }

    try {
      const created = await apiPost('products', payload);
      const id = created?.data?.id;
      console.log(`Created product ${payload.name || '(no-name)'} id=${id}`);
    } catch (err) {
      console.error(`Failed to create product ${payload.name || JSON.stringify(payload)}:`, err.message);
    }
  }

  console.log('Import finished.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});


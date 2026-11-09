import { storageConfigured } from './_store.js';
import { hermesHealthCached } from './_hermes.js';

// Tells the page which features are switched on. Never returns secrets or the Hermes address.
// ai: Hermes answered GET ${HERMES_URL}/health within 3 seconds.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const hermes = await hermesHealthCached();
  res.status(200).json({ ok: true, ai: hermes.ok, db: storageConfigured });
}

import { Duplex } from 'node:stream';
import { SpiderContext } from '../context.js';
import { fileNameFromHeaders } from '../helpers/mime.js';
import { saveUrls, enqueueRequests } from '../links/index.js';
import { Robots } from '../../tools/robots.js';
import { FoundLink } from '../../tools/html/find-links.js';
import { Spidergram } from '../../index.js';
import { ensureDir } from 'fs-extra';
import path from 'node:path';

// Very similar to sitemapHandler, but we also stick rulesets in the global
// Robots object for use when filtering URLs.

export async function robotsTxtHandler(context: SpiderContext) {
  const { graph, files, saveResource } = context;
  const resource = await saveResource();

  const response = await fetch(resource.parsed).then(r => {
    if (r.status !== 200) throw new Error('Could not download');
    return r;
  });

  if (response.body) {
    const fileName =
      resource.key +
      '-' +
      fileNameFromHeaders(new URL(resource.url), resource.headers);

    const proj = await Spidergram.load();
    const directory = path.join(
      'downloads',
      resource.parsed.hostname.replaceAll('.', '-'),
      resource.mime?.replaceAll('/', '-') ?? 'unknown',
    );
    await ensureDir(
      path.join(proj.config.storageDirectory ?? './storage', directory),
    );
    const fullPath = path.join(directory, fileName);
    await files().writeStream(fullPath, Duplex.from(response.body));

    resource.payload = { bucket: 'downloads', path: fullPath };
    await graph.push(resource);

    // Read it back in and pass along
    const txt = await files().read(fileName);
    const hostUrl = new URL(context.request.url);
    hostUrl.pathname = '';
    Robots.setRules(hostUrl, txt.toString());

    const sitemaps = Robots.getSitemaps(hostUrl);
    const links: FoundLink[] = sitemaps.map(s => {
      return { url: s };
    });
    await saveUrls(context, links, { handler: 'sitemap' }).then(savedLinks =>
      enqueueRequests(context, savedLinks),
    );
  }
  return Promise.resolve();
}

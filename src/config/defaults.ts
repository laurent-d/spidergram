/**
 * These exported constants contain default values for Spidergram classes and
 * functions that accept complex options or configuration. Classes relying on
 * these defaults should access them via the {@link Spidergram} singleton
 * class; it handles overriding them with any user-supplied defaults, and handles
 * the complex logic of overriding the provided defaults with environment vars
 * when appropriate.
 */

import path from 'path';
import { NormalizerOptions, SpidergramConfig } from './index.js';
import { mimeGroups } from '../spider/helpers/mime.js';
import {
  UrlMatchStrategy,
  EnqueueUrlOptions,
  SpiderOptions,
} from '../spider/index.js';
import {
  PageDataOptions,
  PageContentOptions,
  HtmlToTextOptions,
} from '../tools/html/index.js';
import { PageTechnologyOptions } from '../tools/browser/index.js';
import { readPackageUpSync } from 'read-pkg-up';
import { AqQuery } from 'aql-builder';
import { PageAnalysisOptions } from '../tools/analyze-page.js';

export const urlNormalizerDefaults: NormalizerOptions = {
  forceProtocol: 'https:',
  forceLowercase: 'host',
  discardSubdomain: 'ww*',
  discardAnchor: true,
  discardAuth: true,
  discardIndex: '**/{index,default}.{htm,html,aspx,php}',
  discardSearch: '!{page,p}',
  discardTrailingSlash: false,
  sortSearchParams: true,
};

export const urlDiscoveryDefaults: EnqueueUrlOptions = {
  limit: 1_000_000,
  selectors: 'a',
  regions: {},
  save: UrlMatchStrategy.All,
  enqueue: UrlMatchStrategy.SameDomain,
  discardEmpty: true,
  discardlocalAnchors: true,
  discardNonWeb: false,
  discardUnparsable: false,
  discardExisting: true,
};

export const htmlToTextDefaults: HtmlToTextOptions = {
  wordwrap: false,
  selectors: [{ selector: 'a', options: { ignoreHref: true } }],
};

export const spiderDefaults: Partial<SpiderOptions> = {
  preNavigationHooks: [],
  postNavigationHooks: [],
  pageHandler: undefined,
  requestHandlers: {},
  urlOptions: urlDiscoveryDefaults,
  parseMimeTypes: mimeGroups.page,
  downloadMimeTypes: [],
  userAgent: `Spidergram ${readPackageUpSync()?.packageJson?.version}`,
  handlerTimeout: 180,
};

export const pageDataDefaults: PageDataOptions = {
  attributes: true,
  head: true,
  meta: true,
  links: false,
  noscript: false,
  scripts: false,
  json: true,
  styles: false,
  templates: false,
};

export const pageTechnologyDefaults: PageTechnologyOptions = {
  forceReload: false,
  ignoreCache: false,
  technologiesUrl:
    'https://raw.githubusercontent.com/wappalyzer/wappalyzer/master/src/technologies',
  categoriesUrl:
    'https://raw.githubusercontent.com/wappalyzer/wappalyzer/master/src/categories.json',
  technologies: {},
  categories: {},
};

export const pageContentDefaults: PageContentOptions = {
  readability: true,
  allowMultipleContentElements: false,
  defaultToFullDocument: true,
  trim: true,
};

export const defaultQueries: Record<string, AqQuery> = {
  errorPages: {
    collection: 'resources',
    filters: [{ name: 'code', eq: 200, negate: true }],
    aggregates: [['site', 'parsed.hostname'], 'mime', 'code'],
    count: 'pages',
  },
};

export const arangoDefaults = {
  databaseName: 'spidergram',
  url: 'http://127.0.0.1:8529',
  auth: {
    username: 'root',
    password: '',
  },
};

export const analyzePageDefaults: PageAnalysisOptions = {
  data: pageDataDefaults,
  content: {},
  tech: {},
  regions: {},
  propertyMap: {},
};

export const spidergramDefaults: SpidergramConfig = {
  debug: false,
  logLevel: 'error',
  storageDirectory: path.join(process.cwd(), 'storage'),
  arango: arangoDefaults,
  crawlee: {},
  spider: spiderDefaults,
  htmlToText: htmlToTextDefaults,
  queries: defaultQueries,
  reports: {},
  pageAnalysis: analyzePageDefaults,
  pageData: pageDataDefaults,
  pageContent: pageContentDefaults,
  pageTechnologies: pageTechnologyDefaults,
  urlNormalizer: urlNormalizerDefaults,
};

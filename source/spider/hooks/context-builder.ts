import {CombinedContext} from '../context.js';
import {UniqueUrl} from '../../model/index.js';
import * as helpers from '../helpers/index.js';
import * as urls from '../urls/index.js';
import {PlaywrightSpider} from '../playwright-spider.js';
import {CheerioSpider} from '../cheerio-spider.js';

export async function contextBuilder(context: CombinedContext) {
  const crawler = context.crawler as PlaywrightSpider | CheerioSpider;

  // Map our 'contextualized' functions to the context object
  Object.assign(context, {
    prefetchRequest: async () => helpers.prefetchRequest(context),

    saveResource: async (data?: Record<string, unknown>) =>
    helpers.saveResource(context, data),

    enqueueLinks: (options?: urls.UrlDiscoveryOptions) =>
    urls.enqueue(context, options),

    findUrls: (options?: urls.UrlDiscoveryOptions) =>
    urls.findUrls(context, options),

    saveUrls: (input: urls.HtmlLink[], options?: urls.UrlDiscoveryOptions) =>
    urls.saveUrls(input, context, options),

    saveRequests: (input: UniqueUrl[], options?: urls.UrlDiscoveryOptions) =>
    urls.saveRequests(input, context, options),

    ...crawler.options,
  });

  urls.saveCurrentUrl(context);
}

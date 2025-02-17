import { BrowserTools } from '../../tools/index.js';
import { SpiderContext } from '../context.js';

export async function pageHandler(context: SpiderContext) {
  const { saveResource, enqueueUrls, page } = context;

  const body = await page.content();
  const cookies = context.saveCookies
    ? await page.context().cookies()
    : undefined;

  const accessibility = context.auditAccessibility
    ? await BrowserTools.AxeAuditor.run(page).then(results =>
        context.auditAccessibility === 'summary'
          ? BrowserTools.AxeAuditor.totalByImpact(results)
          : results,
      )
    : undefined;

  const timing = context.savePerformance
    ? await BrowserTools.getPageTiming(page)
    : undefined;

  const xhr = context.saveXhrList
    ? await BrowserTools.getXhrList(page)
    : undefined;

  await saveResource({ body, cookies, xhr, accessibility, timing });
  await enqueueUrls();

  return Promise.resolve();
}

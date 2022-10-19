import { ArangoStore } from '../../source/arango-store.js';
import { PlaywrightSpider } from '../../source/spider/index.js';
import { log } from 'crawlee';
import { ProcessOptions, processResources } from '../../source/analysis/index.js';
import { Spreadsheet, RowData } from '../../source/spreadsheet.js';

// Assorted parsing helpers
import { getMeta } from '../../source/analysis/index.js';
import { htmlToText } from 'html-to-text';
import readability from 'readability-scores';
import { UrlHierarchy } from '../../source/analysis/hierarchy/url-hierarchy.js';

import { LinkSummaries } from '../../source/reports/link-summaries.js';
import { AqlQuery, aql } from 'arangojs/aql.js';
import { Listr } from 'listr2';

interface Ctx {
  project: string;
  targetDomain: string;
  storage: ArangoStore;
}

log.setLevel(log.LEVELS.ERROR);

await new Listr<Ctx>([
  {
    title: 'Setup',
    task: async (ctx, task) => {
      ctx.targetDomain = await task.prompt({
        type: 'Text',
        message: 'Target domain:',
        initial: 'example.com'
      });
      ctx.project = ctx.targetDomain.replace('.', '_')
      ctx.storage = await ArangoStore.open(ctx.project);
      task.title = `Analyzing ${ctx.targetDomain}`;
    }
  },
  {
    title: 'Site crawl',
    enabled: true,
    task: async (ctx, task) => {
      const spider = new PlaywrightSpider({
        storage: ctx.storage,
        autoscaledPoolOptions: {
          maxConcurrency: 5,
          maxTasksPerMinute: 360
        }
      });
      const c = await spider.run([`https://${ctx.targetDomain}`]);
      task.title = `${c.requestsFinished} requests processed, ${c.requestsFailed} failed, in ${c.requestTotalDurationMillis / 1000}s`;
      return Promise.resolve();
    }
  },
  {
    title: 'Post-processing',
    task: async (ctx, task) => {
      const filter = aql`FILTER resource.body != ''`;
      const options:ProcessOptions = {
        metadata: resource => (resource.body) ? getMeta(resource.body) : undefined,
        text: resource => (resource.body) ? htmlToText(resource.body, { 
          baseElements: { selectors: ['main'] }
        }) : undefined,
        readability: resource => (resource.text) ? readability(resource.text as string) : undefined,
        'template': resource => {
          const classes = resource.get('metadata.body.class') as string[] | undefined;
          if (classes !== undefined) {
            return classes.find(cls => cls.startsWith('tmpl-'))?.replace('tmpl-', '') ?? '';
          }
          return '';
        },
        'section': resource => {
          const classes = resource.get('metadata.body.class') as string[] | undefined;
          if (classes !== undefined) {
            return classes.find(cls => cls.startsWith('sect-'))?.replace('sect-', '') ?? '';
          }
          return '';
        },
        'date': (resource, root) => {
          if (root === undefined) return '';
          return root('aside.page-meta time').attr('datetime')?.toString() ?? '';
        }
      }
      const processResults = await processResources(filter, options, ctx.storage);
      task.title = `Records processed, ${Object.keys(processResults.errors).length} errors.`;
      return Promise.resolve();
    }
  },
  {
    title: 'URL Tree mapping',
    task: async (ctx, task) => {
      await ctx.storage.collection('is_child_of').truncate();
      const urlHier = new UrlHierarchy(ctx.storage);
      const query = aql`FILTER uu.parsed.domain == 'ethanmarcotte.com'`;
      return urlHier.loadPool(query)
        .then(() => urlHier.buildRelationships())
        .then(() => urlHier.save());
    }
  },
  {
    title: 'Report generation',
    task: async (ctx, task) => {
      const queries: Record<string, AqlQuery> = {
        'Pages': LinkSummaries.pages(),
        'Errors': LinkSummaries.errors(),
        'Malformed URLs': LinkSummaries.malformed(),
        'Non-Web URLs': LinkSummaries.excludeProtocol(),
        'External Links': LinkSummaries.outlinks([ctx.targetDomain])
      };

      const report = new Spreadsheet();
      for (let name in queries) {
        ctx.storage.query<RowData>(queries[name])
          .then(cursor => cursor.all())
          .then(result => report.addSheet(result, name));
      }
      return report.save(`storage/${ctx.targetDomain}`)
        .then(fileName => { task.title = `${fileName} generated.` })
    }
  }
]).run();
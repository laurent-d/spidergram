import { EventEmitter } from 'node:events';
import is from '@sindresorhus/is';
import PQueue from 'p-queue';
import { ParsedUrl, NormalizedUrl } from '@autogram/url-tools';
import { Entity, UniqueUrlSet, UniqueUrl } from '../graph/index.js';
import { INTERVALS } from '../index.js';
import { Fetcher, GotFetcher } from '../fetch/index.js';
import { Crawler } from './crawler.js';

export type PostFetchFunction = (uu: UniqueUrl, entities: Entity[]) => Entity[];

export interface QueueOptions {
  concurrency?: number;
  interval?: number;
  intervalCap?: number;
  timeout?: number;
  autoStart?: boolean;
}

export class SimpleCrawler extends EventEmitter implements Crawler {
  fetcher: Fetcher;
  postFetch: PostFetchFunction;

  rules = {
    ignore: (url: ParsedUrl) => false,
  };

  queueSettings: QueueOptions = {
    concurrency: 20,
    interval: INTERVALS.second,
    intervalCap: 5,
    timeout: INTERVALS.minute * 3,
    autoStart: true,
  };

  progress = {
    total: 0,
    fetched: 0,
    skipped: 0,
    errors: 0,
    invalid: 0,
  };

  constructor(customFetcher?: Fetcher, postFetch?: PostFetchFunction) {
    super();
    this.fetcher = customFetcher ?? new GotFetcher();
    this.postFetch = postFetch ?? ((uu, entities) => entities);
  }

  eventNames(): string[] {
    return ['start', 'skip', 'process'];
  }

  async crawl(input?: UniqueUrlSet | UniqueUrl[] | NormalizedUrl[] | string[]): Promise<Entity[]> {
    const urls = (input instanceof UniqueUrlSet) ? input : new UniqueUrlSet(input, true);
    const queue = new PQueue(this.queueSettings);
    const promises: Array<Promise<void>> = [];
    const results: Entity[] = [];

    this.progress.total = urls.size;
    this.progress.invalid = urls.unparsable.size;

    this.fetcher
      .on('skip', (uu: UniqueUrl) => {
        this.progress.skipped++;
        this.emit('process', uu, this.progress);
      })
      .on('fetch', (uu: UniqueUrl) => {
        this.progress.fetched++;
        this.emit('process', uu, this.progress);
      })
      .on('status', (uu: UniqueUrl) => {
        this.progress.fetched++;
        this.emit('process', uu, this.progress);
      })
      .on('fail', (error: unknown, uu: UniqueUrl) => {
        this.progress.errors++;
        this.emit('process', uu, this.progress);
      })

    this.emit('start', this.progress);

    for (const uu of [...urls]) {
      if (is.urlInstance(uu.parsed) && this.rules.ignore(uu.parsed)) {
        this.progress.skipped++;
        this.emit('process', uu, this.progress);
      }

      promises.push(
        queue.add(async () => {
          await this.fetcher
            .fetch(uu)
            .then((entities) => this.postFetch(uu, entities))
            .then((entities) => {
              results.push(...entities);
            });
        }),
      );
    }

    await Promise.all(promises);
    this.emit('finish', this.progress);
    return results;
  }
}
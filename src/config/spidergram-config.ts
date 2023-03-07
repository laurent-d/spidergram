import { Spidergram } from './spidergram.js';
import { SpiderOptions, Query } from '../index.js';
import { UrlMutators } from '@autogram/url-tools';
import { NormalizerOptions } from './global-normalizer.js';
import {
  HtmlToTextOptions,
  PageContentExtractor,
  PageContentOptions,
  PageDataExtractor,
  PageDataOptions,
} from '../tools/html/index.js';

import { Configuration as FileConfiguration } from 'typefs';
import { Config as ArangoConfig } from 'arangojs/connection';
import { LoggerOptions } from 'caterpillar';
import { AqQuery } from 'aql-builder';
import { GeneratedAqlQuery } from 'arangojs/aql';
import {
  Configuration as CrawleeConfig,
  ConfigurationOptions as CrawleeConfigOptions,
} from 'crawlee';

/**
 * Global configuration settings for Spidergram and its key components. Many of these
 * settings support "plain vanilla" JSON values, as well as richer settings values
 * like inline functions and class instances. This allows JSON based configuration
 * files to control Spidergram settings in most cases, whhile .js or .ts config scripts
 * get more precise contextual control.
 */
export interface SpidergramConfig extends Record<string, unknown> {
  /**
   * A global flag that can be used to control performance monitoring and other
   * non-production behaviors. Can be overidden by setting the SPIDERGRAM_DEBUG
   * environment variable.
   *
   * @defaultValue: `false`
   */
  debug?: boolean;

  logToConsole?: boolean;

  logToDatabase?: boolean | string;

  /**
   * The default level of log message Spidergram will process or display.
   * Can be overidden by setting the SPIDERGRAM_LOG_LEVEL environment
   * variable. Setting the log level to -1 disables logging entirely.
   *
   * - 0: emergency / emerg
   * - 1: alert
   * - 2: critical / crit
   * - 3: error / err
   * - 4: warning / warn
   * - 5: notice / note
   * - 6: info
   * - 7: debug
   *
   * @defaultValue: `error`
   */
  logLevel?: LoggerOptions['defaultLevel'] | false;

  /**
   * The directory where data generated by Spidergram is stored.
   * This defaults to './storage' in the current working directory,
   * and can also be overriden by setting the SPIDERGRAM_STORAGE_DIR
   * environment variable.
   *
   * @defaultValue `process.cwd() + '/storage'`
   */
  storageDirectory?: string;

  /**
   * Configuration for the project's storage buckets. This defaults to
   * a local disk bucket at the path specified in `storageDirectory`.
   *
   * Using other TypeFS plugins, this can be changed to an S3 storage
   * directory, etc.
   */
  typefs?: FileConfiguration;

  /**
   * Connection details for an Arango database server. If no
   * connection information is specified, a localhost server
   * and 'root' user will be assumed.
   */
  arango?: ArangoConfig;

  /**
   * Settings for the project's default URL normalizer. These control
   * which URLs will be considered duplicates of each other.
   *
   * Alternatively, a custom function can be passed in for more control
   * over the URL transformation process.
   */
  urlNormalizer?: NormalizerOptions | UrlMutators.UrlMutator;

  /**
   * Configuration options for Crawlee, the web scraping toolkit used by
   * Spidergram. By default, Spidergram will map its own logging, storage,
   * and memory settings to Crawlee's. This configuration property can be used
   * to explicitly alter Crawlee's configuration with options or a
   * pre-instantiated Crawlee Configuration instance.
   */
  crawlee?: CrawleeConfigOptions | CrawleeConfig;

  /**
   * Spidergram's default options for Spidering/scraping sites. Custom options
   * can still be created and passed into the Spider at runtime, but the default
   * crawling, mimetype filtering, URL discovery, and other options can be set
   * here.
   */
  spider?: Partial<SpiderOptions>;

  /**
   * Global defaults for HTML to plaintext conversion.
   *
   * Some Spidergram tools override these defaults in order to accomplish specific tasks
   * (converting HTML to markdown, stripping images and links, etc) but these options will
   * be respcted whenever possible.
   */
  htmlToText?: HtmlToTextOptions;

  /**
   * Extraction options for core content on crawled pages.
   *
   * An options object, or a custom async {@link PageContentExtractor|Extractor} function,
   * can be provided here. Note that the options object contains an `htmlToText` property,
   * which can be used to conditionally override global `htmlToText` defaults.
   */
  pageContent?: PageContentOptions | PageContentExtractor;

  /**
   * Extraction options for structured metadata on crawled pages.
   *
   * An options object, or a custom async {@link PageDataExtractor|Extractor} function,
   * can be provided here.
   */
  pageData?: PageDataOptions | PageDataExtractor;

  /**
   * A key/value collection of pre-written queries that can be used
   * elsewhere in Spidergram. Values can be {@link AqQuery|AqQuery} JSON objects,
   * {@link GeneratedAqlQuery|Generated AQL Queries} output by the @{link aql | aql}
   * function, or fully-instantiated Spidergram {@link Query|Query} objects.
   */
  queries?: Record<string, AqQuery | GeneratedAqlQuery | Query>;

  /**
   * An object containing named collections of queries; each collection forms a single
   * "report" appropriate for exporting in JSON or XLSX format.
   *
   * Individual queries can be {@link AqQuery} JSON structures, {@link GeneratedAqlQuery}
   * instances, {@link Query} instances, or strings that act as lookup keys for the
   * {@link SpidergramConfig.queries} collection.
   */
  reports?: Record<
    string,
    Record<string, string | AqQuery | GeneratedAqlQuery | Query>
  >;

  /**
   * A custom setup function to be run after Spidergram has been initialized
   * from the settings in its config file. The finalize hook receives a reference
   * to the global Spidergram singleton object, and can use its methods (`setLogger`
   * and so on) to alter the global configuration.
   */
  finalize?: (context: Spidergram) => Promise<void>;
}

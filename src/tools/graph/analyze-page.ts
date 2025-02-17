import {
  Spidergram,
  Resource,
  HtmlTools,
  BrowserTools,
} from '../../index.js';
import { relinkResource } from './relink-resource.js';
import { PageDataOptions, PageContentOptions } from '../html/index.js';
import { TechAuditOptions } from '../browser/index.js';
import { PropertySource, findPropertyValue } from '../find-property-value.js';
import is from '@sindresorhus/is';
import _ from 'lodash';
import { EnqueueLinksOptions } from 'crawlee';
import { DateTime } from 'luxon';
import {
  MimeTypeMap,
  processResourceFile,
} from '../file/process-resource-file.js';

export type PageAnalyzer = (
  input: Resource,
  options: PageAnalysisOptions,
) => Promise<Resource>;

/**
 * Options to control the behavior of the processPage utility function.
 */
export interface PageAnalysisOptions extends Record<string, unknown> {
  /**
   * Options for structured data parsing, including HTML Meta tags and other
   * metadata standards. Setting this to `false` skips all metadata extraction.
   *
   * Note: By default, running data extraction will overwrite any information in a
   * Resource object's existing `data` property.
   */
  data?: PageDataOptions | boolean;

  /**
   * If a resource passed in for analysis has a file attachment, this mapping dictionary
   * determines which GenericFile class will be responsible for parsing it.
   *
   * Setting this value to `false` will bypass all downloaded file parsing.
   *
   * @defaultValues
   */
  files?: MimeTypeMap | false;

  /**
   * Options for content analysis, including the transformation of core page content
   * to plaintext, readability analysis, etc. Setting this to `false` skips all content
   * analysis.
   *
   * Note: By default, running content analysis will overwrite any information in a
   * Resource object's existing `content` property.
   */
  content?: PageContentOptions | boolean;

  /**
   * Options for technology fingerprinting. Setting this to `false` skips all fingerprinting.
   */
  tech?: TechAuditOptions | boolean;

  /**
   * Options for rebuilding the metadata for a page's outgoing links.
   *
   * @defaultValue: false
   */
  links?: EnqueueLinksOptions | boolean;

  /**
   * A dictionary describing simple data mapping operations that should be performed after
   * a page is processed. Each key is the name of a target property on the page object,
   * and each value is a string or {@link PropertySource} object describing where the target
   * property's value should be found.
   *
   * If an array of sources is supplied, they will be checked in order and the first match
   * will be
   */
  propertyMap?:
    | Record<string, (string | PropertySource) | (string | PropertySource)[]>
    | boolean;
}

export async function analyzePage(
  resource: Resource,
  customOptions: PageAnalysisOptions = {},
): Promise<Resource> {
  const sg = await Spidergram.load();
  if (is.function_(sg.config.analyzePageFn)) {
    return sg.config.analyzePageFn(resource, customOptions);
  } else {
    return _analyzePage(resource, customOptions);
  }
}

async function _analyzePage(
  resource: Resource,
  customOptions: PageAnalysisOptions = {},
): Promise<Resource> {
  const options: PageAnalysisOptions = _.defaultsDeep(
    customOptions,
    Spidergram.config.pageAnalysis,
  );

  if (options.data) {
    resource.data = await HtmlTools.getPageData(
      resource,
      options.data === true ? undefined : options.data,
    );
  }

  if (options.content) {
    resource.content = await HtmlTools.getPageContent(
      resource,
      options.content === true ? undefined : options.content,
    );
  }

  if (options.files !== false) {
    const fileData = await processResourceFile(
      resource,
      options.files ? options.files : {},
    );
    if (fileData.metadata) resource.data = fileData.metadata;
    if (fileData.content) resource.content = fileData.content;
  }

  if (options.tech) {
    await BrowserTools.TechAuditor.init(
      options.tech === true ? undefined : options.tech,
    );
    resource.tech = await BrowserTools.TechAuditor.run(resource).then(results =>
      BrowserTools.TechAuditor.summarizeByCategory(results),
    );
  }

  if (options.links) {
    await relinkResource(
      resource,
      options.links === true ? undefined : options.links,
    );
  }

  if (options.propertyMap) {
    for (const [prop, source] of Object.entries(options.propertyMap)) {
      resource.set(prop, findPropertyValue(resource, source));
    }
  }

  resource._analyzed = DateTime.now().toISO();

  return Promise.resolve(resource);
}

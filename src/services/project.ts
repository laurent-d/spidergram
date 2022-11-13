import process from 'node:process';
import path from 'node:path';
import { PathLike } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';

import {PartialDeep} from 'type-fest';
import is from '@sindresorhus/is';

import {Storage as FileStore, Configuration as FileConfiguration} from 'typefs';
import {Config as ArangoConfig} from 'arangojs/connection';
import * as dotenv from 'dotenv';

import {ArangoStore} from './arango-store.js';
import { UrlMutatorWithContext } from '../spider/index.js';
import { NormalizedUrl, UrlMutators } from '@autogram/url-tools';

dotenv.config();

export interface ProjectConfig {
  /**
	 * A unique name identifying the current project; used
	 * for reporting purposes and to generate an Arango database
	 * name if no explicit graph configuration options are supplied.
	 *
	 * @default 'spidergram'
	 * @type {string}
	 */
  name: string;

  /**
	 * An optional description of the project and its purpose.
	 *
	 * @type {string}
	 */
  description?: string;

  /**
	 * The directory where data generated by the project is stored.
   * This defaults to the current working directory (process.cwd()),
   * and can be overriden by setting the SPIDERGRAM_PROJECT_ROOT 
   * environment variable.
	 *
	 * @type {string}
	 */
  root: string;

  /**
	 * Configuration for the project's storage buckets; by default
	 * a single file bucket in the `./storage` directory of the node.js
	 * project will be used.
	 *
	 * @example
	 * const files = {
	 *	 default: 'downloads',
	 *   disks: {
	 *	   downloads: {
	 *	     driver: 'file',
	 *		   root: './storage/downloads',
	 *		   jail: true,
	 *	   },
	 *	   config: {
	 *	     driver: 'file',
	 *		   root: './storage/config',
	 *		   jail: true,
	 *	   }
	 *   }
	 * };
	 *
	 * @type {FileConfiguration}
	 */
  files: FileConfiguration;

  graph: {
    /**
		 * Connection details for an Arango database server. If no
		 * connection information is specified, a localhost server
		 * and 'root' user will be used.
		 *
		 * @type {ArangoConfig}
		 */
    connection: ArangoConfig;
  };

  /**
	 * Settings for the project's default URL normalizer. These control
   * which URLs will be considered duplicates of each other. File-based
   * configuration of the project allows normalizer features to be turned
   * on and off, but in code a custom function can be supplied that takes
   * URL context (the page it appears on, etc) into account.
	 *
	 * @type {NormalizerOptions}
	 */
  normalizer: NormalizerOptions;

  /**
   * The local path of the project's configuration file, if one exists.
   * 
   * *NOTE:* This property is set by the 
   * 
   * @type {?string}
   */
  _configFilePath?: string;
}

export class Project {
  private static _instance?: Project;

  static get defaultConfigFilePath(): string {
    return process.env.SPIDERGRAM_CONFIG_FILE
      ?? path.join(process.env.SPIDERGRAM_PROJECT_ROOT ?? process.cwd(), 'spidergram.json');
  }

  static async loadConfig(path: PathLike): Promise<PartialDeep<ProjectConfig> | false> {
    return readFile(path, { flag: 'r' })
      .then(buffer => {
        const results = JSON.parse(buffer.toString());
        results._configFilePath = path.toString();
        return results;
      })
      .catch((error: unknown) => false);
  }

  static async config(
    config?: PathLike | PartialDeep<ProjectConfig>,
  ): Promise<Project> {
    if (Project._instance === undefined) {
      config ??= Project.defaultConfigFilePath;
      let populatedConfig: ProjectConfig | undefined = undefined;
      let incomingOptions: PartialDeep<ProjectConfig> = {};
      let configFilePath: string | undefined = undefined;

      // Is it a PathLike? We're getting the location of a config file.
      if (is.string(config) || is.urlInstance(config) || is.buffer(config)) {
        const loadedOptions = await Project.loadConfig(config);
        if (loadedOptions !== false) {
          configFilePath = config.toString();
          populatedConfig = Project.mergeDefaults(incomingOptions);
        } else {
          populatedConfig = projectConfigDefaults;
        }
      } else {
        incomingOptions = config;
        populatedConfig = Project.mergeDefaults(config);
      }

      Project._instance = new Project(populatedConfig, incomingOptions, configFilePath);
      FileStore.config = populatedConfig.files;
    }
    return Project!._instance!;
  }

  private static mergeDefaults(options: PartialDeep<ProjectConfig> = {}): ProjectConfig {
    return {
      name: (options.name ?? projectConfigDefaults.name),
      root: (options.root ?? projectConfigDefaults.root),
      graph: {
        ...options.graph,
        ...projectConfigDefaults.graph,
      },
      files: {
        ...options.files,
        ...projectConfigDefaults.files,
      },
      normalizer: (options.normalizer ?? projectConfigDefaults.normalizer)
    };
  }

  readonly name: string;
  readonly description?: string;
  readonly root: string;

  get normalizer(): UrlMutatorWithContext {
    return NormalizedUrl.normalizer;
  }
  
  set normalizer(input: UrlMutatorWithContext) {
    NormalizedUrl.normalizer = input;
  }

  get files() {
    return FileStore.disk.bind(FileStore);
  }

  async graph(name?: string): Promise<ArangoStore> {
    const dbName = name ?? this.configuration.graph.connection.databaseName ?? this.configuration.name;
    const dbConn = this.configuration.graph.connection;

    return ArangoStore.open(dbName, dbConn);
  }

  private constructor(
    public readonly configuration: ProjectConfig,
    public readonly options: PartialDeep<ProjectConfig>,
    public readonly configFilePath?: string
  ) {
    this.name = configuration.name;
    this.description = configuration.description;
    this.root = configuration.root;
  
    this.normalizer = makeNormalizer(options.normalizer);
  }

  async saveConfig(path?: PathLike) {
    return writeFile(
      path ?? Project.defaultConfigFilePath,
      JSON.stringify(this.configuration),
      { flag: 'w' }
    );
  }
}

export const projectConfigDefaults: ProjectConfig = {
  name: 'spidergram',
  root: process.env.SPIDERGRAM_PROJECT_ROOT ?? process.cwd(),
  files: {
    default: 'storage',
    disks: {
      config: {
        driver: 'file',
        root: path.join(process.env.SPIDERGRAM_PROJECT_ROOT ?? process.cwd(), 'config'),
        jail: true,
      },
      storage: {
        driver: 'file',
        root: path.join(process.env.SPIDERGRAM_PROJECT_ROOT ?? process.cwd(), 'storage'),
        jail: true,
      },
      output: {
        driver: 'file',
        root: path.join(process.env.SPIDERGRAM_PROJECT_ROOT ?? process.cwd(), 'output'),
        jail: true,
      },
    },
  },
  graph: {
    connection: {
      url: process.env.SPIDERGRAM_ARANGO_URL ?? 'http://127.0.0.1:8529',
      auth: {
        username: process.env.SPIDERGRAM_ARANGO_USER ?? 'root',
        password: process.env.SPIDERGRAM_ARANGO_PASS ?? '',
      },
    },
  },
  normalizer: {
    forceProtocol: 'https:',
    forceLowercase: 'host',
    discardSubdomain: 'ww*',
    discardAnchor: true,
    discardAuth: true,
    discardIndex: '**/{index,default}.{htm,html,aspx,php}',
    discardSearch: '*',
    discardTrailingSlash: false,
  }
}

export interface NormalizerOptions {
  forceProtocol?: 'https:' | 'http:' | false;
  forceLowercase?: 'host' | 'domain' | 'subdomain' | 'href' | false;
  discardSubdomain?: string | false;
  discardAnchor?: boolean;
  discardAuth?: boolean;
  discardIndex?: string | false;
  discardSearch?: string;
  discardTrailingSlash?: boolean;
}

export function makeNormalizer(options: NormalizerOptions = {}): UrlMutatorWithContext {
  return (url, context) => {
    if (options.forceProtocol) url = UrlMutators.forceProtocol(url, options.forceProtocol);
    if (options.forceLowercase) url[options.forceLowercase] = url[options.forceLowercase].toLocaleLowerCase();
    if (options.discardSubdomain) url = UrlMutators.stripSubdomains(url, options.discardSubdomain);
    if (options.discardAnchor) url = UrlMutators.stripAnchor(url);
    if (options.discardAuth) url = UrlMutators.stripAuthentication(url);
    if (options.discardIndex) url = UrlMutators.stripIndexPages(url, options.discardIndex);
    if (options.discardSearch) url = UrlMutators.stripQueryParameters(url, options.discardSearch);
    if (options.discardTrailingSlash) url = UrlMutators.stripTrailingSlash(url);
    return url;
  }
}
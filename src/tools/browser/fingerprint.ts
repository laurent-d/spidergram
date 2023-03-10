import type {
  Technology as FingerprintTechnology,
  Category as FingerprintCategory,
  Input as FingerprintInput,
  Resolution as FingerprintResult,
} from 'wappalyzer-core';
import { parse as parseCookie } from 'set-cookie-parser';
import pkg from 'wappalyzer-core';
const { analyze, resolve, setCategories, setTechnologies } = pkg;

import { Spidergram, Resource, HtmlTools } from '../../index.js';
import _ from 'lodash';

export type {
  Technology as FingerprintTechnology,
  Category as FingerprintCategory,
  Input as FingerprintInput,
  Resolution as FingerprintResult,
} from 'wappalyzer-core';

export type FingerprintOptions = {
  technologiesUrl?: string,
  categoriesUrl?: string,
  technologies?: Record<string, FingerprintTechnology>;
  categories?: Record<string, FingerprintCategory>;
  forceReload?: boolean;
  ignoreCache?: boolean;
};

export class Fingerprint {
  protected loaded = false;

  async analyze(
    input: string | Response | Resource | FingerprintInput,
    technologies?: FingerprintTechnology[],
  ): Promise<FingerprintResult[]> {
    let inputStruct: FingerprintInput = {};

    if (typeof input === 'string') {
      inputStruct = await this.extractBodyData(input);
    } else if (input instanceof Resource) {
      inputStruct = await this.extractResourceInput(input);
    } else if (input instanceof Response) {
      inputStruct = await this.extractResponseInput(input);
    } else {
      inputStruct = input;
    }

    return Promise.resolve(resolve(analyze(inputStruct, technologies)));
  }

  async loadDefinitions(customOptions: FingerprintOptions = {}): Promise<this> {
    const sg = await Spidergram.load();
    const options: FingerprintOptions = _.defaultsDeep(customOptions, Spidergram.config.pageTechnologies);

    if (!this.loaded || options.forceReload) {
      let categories: Record<string, FingerprintCategory> = {};
      let technology: Record<string, FingerprintTechnology> = {};

      const catExists = await sg
        .files()
        .exists('wappalyzer-categories.json');

      const techExists = await sg
        .files()
        .exists('wappalyzer-technologies.json');

      if (!catExists || options.ignoreCache) await this.cacheCategories(
        options.categoriesUrl ?? 'https://raw.githubusercontent.com/wappalyzer/wappalyzer/master/src/categories.json'
      );
      if (!techExists || options.ignoreCache) await this.cacheTechnologies(
        options.technologiesUrl ?? 'https://raw.githubusercontent.com/wappalyzer/wappalyzer/master/src/technologies'
      );

      if (await sg.files().exists('wappalyzer-categories.json')) {
        const json = (
          await sg.files().read('wappalyzer-categories.json')
        ).toString();
        categories = JSON.parse(json) as Record<string, FingerprintCategory>;
      }

      if (await sg.files().exists('wappalyzer-technologies.json')) {
        const json = (
          await sg.files().read('wappalyzer-technologies.json')
        ).toString();
        technology = JSON.parse(json) as Record<string, FingerprintTechnology>;
      }

      setCategories({ ...categories, ...options.categories });
      setTechnologies({ ...technology, ...options.technologies });

      this.loaded = true;
    }

    return Promise.resolve(this);
  }

  protected async cacheTechnologies(techUrl: string) {
    const project = await Spidergram.load();

    const chars = Array.from({ length: 27 }, (value, index) =>
      index ? String.fromCharCode(index + 96) : '_',
    );

    const data = await Promise.all(
      chars.map(async char => {
        const url = new URL(`${techUrl}/${char}.json`);
        return await fetch(url).then(response => response.json());
      }),
    );

    const technologies = data.reduce(
      (acc, obj) => ({
        ...acc,
        ...obj,
      }),
      {},
    );

    return project
      .files()
      .write(
        'wappalyzer-technologies.json',
        Buffer.from(JSON.stringify(technologies)),
      );
  }

  protected async cacheCategories(catUrl: string) {
    const project = await Spidergram.load();

    const url = new URL(catUrl);
    const categories = await fetch(url).then(response => response.json());
    return project
      .files()
      .write(
        'wappalyzer-categories.json',
        Buffer.from(JSON.stringify(categories)),
      );
  }

  async extractBodyData(html: string): Promise<FingerprintInput> {
    const data = await HtmlTools.getPageData(html, { all: true });

    const input: FingerprintInput = {
      html,
      meta: wapifyDict(data.meta ?? {}),
    };

    input.scriptSrc = [];
    input.scripts = '';
    input.css = '';

    for (const script of Object.values(data.scripts ?? {})) {
      if ('src' in script && script.src !== undefined) {
        input.scriptSrc.push(script.src);
      } else {
        input.scripts += script.content ?? '';
      }
    }

    for (const style of Object.values(data.styles ?? {})) {
      if ('content' in style && style.content !== undefined) {
        input.css += style.content;
      }
    }

    return input;
  }

  async extractResponseInput(res: Response): Promise<FingerprintInput> {
    const input: FingerprintInput = {
      url: res.url,
      ...this.extractBodyData(await res.text()),
    };

    res.headers.forEach((value, key) => {
      input.headers ??= {};
      input.cookies ??= {};

      if (key.toLocaleLowerCase() === 'set-cookie') {
        const cookies = parseCookie(value);
        for (const cookie of cookies) {
          input.cookies[cookie.name] = [cookie.value];
        }
      } else {
        input.headers[key.toLocaleLowerCase()] = Array.isArray(value)
          ? value
          : [value];
      }
    });

    return input;
  }

  async extractResourceInput(res: Resource): Promise<FingerprintInput> {
    const input: FingerprintInput = {
      url: res.url,
      ...this.extractBodyData(res.body ?? ''),
    };

    input.headers = {};
    input.cookies = {};

    for (const [key, value] of Object.entries(res.headers)) {
      if (value !== undefined) {
        if (
          key.toLocaleLowerCase() === 'set-cookie' &&
          typeof value === 'string'
        ) {
          const cookies = parseCookie(value);
          for (const cookie of cookies) {
            input.cookies[cookie.name] = [cookie.value];
          }
        } else {
          input.headers[key.toLocaleLowerCase()] = Array.isArray(value)
            ? value
            : [value];
        }
      }
    }

    return input;
  }
}

function wapifyDict(input: Record<string, undefined | string | string[]>) {
  const output: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      output[key.toLocaleLowerCase()] = Array.isArray(value) ? value : [value];
    }
  }
  return output;
}

import { Reference, Edge } from '@autogram/autograph';
import { Dictionary } from '../util/index.js';
import {
  UniqueUrl,
  Resource,
  Status,
  HeaderShape,
  RequestShape,
} from './index.js';

export class RespondsWith extends Edge implements RequestShape {
  predicate = 'responds_with';
  method: string;
  url: string | URL;
  headers: HeaderShape;

  constructor(
    uniqueUrl: Reference<UniqueUrl>,
    response: Reference<Resource | Status>,
    request?: RequestShape,
    extra: Dictionary = {},
  ) {
    super(uniqueUrl, 'responds_with', response);
    this.method = request?.method ?? '';
    this.url = request?.url?.toString() ?? '';
    this.headers = request?.headers ?? {};
  }
}

Edge.types.set('responds_with', RespondsWith);

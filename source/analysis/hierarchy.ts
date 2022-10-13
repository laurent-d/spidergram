import { Vertice, Edge } from '../model/index.js';

export interface HierarchyBuilder<V extends Vertice = Vertice, E extends Edge = Edge> {
  pool: V[];

  load<V>(): Promise<void>;
  build(): Promise<void>;
  save(): Promise<void>;
}
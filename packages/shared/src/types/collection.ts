/**
 * Chronicle Collection Types
 *
 * Collections organize posts into a hierarchical tree structure.
 * Stored in server/data/collection.json.
 */

export type CollectionNodeType = 'post' | 'group'

export interface CollectionNode {
  id: string
  type: CollectionNodeType
  title?: string
  children?: CollectionNode[]
}

export interface Collection {
  name: string
  description: string
  nodes: CollectionNode[]
}

export interface CollectionFile {
  collections: Collection[]
}

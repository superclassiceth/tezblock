export interface Options {
  pageId?: string | number
  isText?: boolean
  showFiatValue?: boolean
  showFullAddress?: boolean
  showAlliasOrFullAddress?: boolean
  forceIdenticon?: boolean
  hideIdenticon?: boolean
  kind?: string //TODO: not needed probably
  comparisonTimestamp?: number
}

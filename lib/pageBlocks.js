export const PAGE_BLOCK_TYPES = {
  CHAPTER_HEADER: "chapter_header",
  SECTION_HEADER: "section_header",
  PARAGRAPH: "paragraph",
  DEFINITION_BOX: "definition_box",
  THEOREM: "theorem",
  EXAMPLE: "example",
  SOLUTION: "solution",
  EQUATION_GROUP: "equation_group",
  RULE_ITEM: "rule_item",
  GRAPH: "graph",
  TABLE: "table",
  GRAPH_PLACEHOLDER: "graph_placeholder",
  TABLE_PLACEHOLDER: "table_placeholder",
  FIGURE_CAPTION: "figure_caption",
  SIDEBAR_NOTE: "sidebar_note",
  EXERCISE_LIST: "exercise_list",
};

/**
 * @typedef {{ x0:number, y0:number, x1:number, y1:number, space?:"pdf"|"image"|"normalized" }} BBox
 */

/**
 * @typedef {{
 *   id: string,
 *   pageNumber: number,
 *   type: string,
 *   order: number,
 *   bbox?: BBox,
 *   originalContent: string,
 *   normalizedContent: string,
 *   translatedContent?: string,
 *   brailleContent?: string,
 *   confidence: number,
 *   children?: PageBlock[],
 * }} PageBlock
 */

/**
 * @param {string} prefix
 * @param {number} pageNumber
 * @param {number} order
 */
export function makeBlockId(prefix, pageNumber, order) {
  return `${prefix || "block"}-${pageNumber}-${String(order).padStart(4, "0")}`;
}

/**
 * @param {Partial<PageBlock> & { pageNumber:number, type:string, order:number }} input
 * @returns {PageBlock}
 */
export function createPageBlock(input) {
  const pageNumber = Number(input.pageNumber || 1);
  const order = Number(input.order || 0);
  const originalContent = String(input.originalContent ?? "");
  const normalizedContent = String(input.normalizedContent ?? originalContent);

  return {
    id: String(input.id || makeBlockId("block", pageNumber, order)),
    pageNumber,
    type: String(input.type),
    order,
    bbox: input.bbox,
    originalContent,
    normalizedContent,
    translatedContent: input.translatedContent,
    brailleContent: input.brailleContent,
    confidence: typeof input.confidence === "number" ? input.confidence : 0.65,
    children: Array.isArray(input.children) ? input.children : undefined,
  };
}

export function isMathBlockType(type) {
  return type === PAGE_BLOCK_TYPES.EQUATION_GROUP;
}

export function isTextBlockType(type) {
  return [
    PAGE_BLOCK_TYPES.CHAPTER_HEADER,
    PAGE_BLOCK_TYPES.SECTION_HEADER,
    PAGE_BLOCK_TYPES.PARAGRAPH,
    PAGE_BLOCK_TYPES.DEFINITION_BOX,
    PAGE_BLOCK_TYPES.THEOREM,
    PAGE_BLOCK_TYPES.EXAMPLE,
    PAGE_BLOCK_TYPES.SOLUTION,
    PAGE_BLOCK_TYPES.RULE_ITEM,
    PAGE_BLOCK_TYPES.FIGURE_CAPTION,
    PAGE_BLOCK_TYPES.SIDEBAR_NOTE,
    PAGE_BLOCK_TYPES.EXERCISE_LIST,
  ].includes(type);
}

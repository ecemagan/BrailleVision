import { PAGE_BLOCK_TYPES } from "./pageBlocks.js";

function getOriginalText(block) {
  return (
    block?.originalText ||
    block?.normalizedContent ||
    block?.originalContent ||
    block?.content ||
    block?.text ||
    ""
  );
}

function getBrailleText(block) {
  return (
    block?.brailleText ||
    block?.brailleContent ||
    block?.braille ||
    block?.normalizedContent ||
    block?.originalContent ||
    block?.content ||
    block?.text ||
    ""
  );
}

function buildEquationGroupSegment(block) {
  const children = Array.isArray(block?.children) ? block.children : [];

  const lines = children.length
    ? children.map((child, index) => ({
        id: child?.id || `${block?.id || "equation-group"}-line-${index + 1}`,
        type: child?.type || "equation_step",
        original: getOriginalText(child),
        braille: getBrailleText(child),
      })).filter((line) => line.original || line.braille)
    : [
        {
          id: `${block?.id || "equation-group"}-line-1`,
          type: "equation_step",
          original: getOriginalText(block),
          braille: getBrailleText(block),
        },
      ];

  return {
    id: block?.id || "equation-group",
    type: PAGE_BLOCK_TYPES.EQUATION_GROUP,
    original: getOriginalText(block),
    braille: getBrailleText(block),
    lines,
  };
}

function buildDisplaySegment(block) {
  const blockType = block?.type || "paragraph";
  const children = Array.isArray(block?.children) ? block.children : [];

  if (blockType === PAGE_BLOCK_TYPES.EQUATION_GROUP) {
    return buildEquationGroupSegment(block);
  }

  if (blockType === PAGE_BLOCK_TYPES.THEOREM && children.length) {
    const theoremChildren = children
      .map((child) => buildDisplaySegment(child))
      .filter((child) => child.original || child.braille || child.lines?.length || child.children?.length);

    return {
      id: block?.id || "theorem-group",
      type: PAGE_BLOCK_TYPES.THEOREM,
      original: getOriginalText(block),
      braille: getBrailleText(block),
      children: theoremChildren,
    };
  }

  return {
    id: block?.id || "segment",
    type: blockType,
    original: getOriginalText(block),
    braille: getBrailleText(block),
  };
}

export function buildDisplaySegments(block) {
  const blockType = block?.type || "paragraph";
  const children = Array.isArray(block?.children) ? block.children : [];

  if (!block) {
    return [];
  }

  if (blockType === PAGE_BLOCK_TYPES.EQUATION_GROUP) {
    return [buildEquationGroupSegment(block)];
  }

  if (blockType === PAGE_BLOCK_TYPES.THEOREM && children.length) {
    return [buildDisplaySegment(block)];
  }

  if (!children.length) {
    return [buildDisplaySegment(block)];
  }

  return children
    .map((child) => buildDisplaySegment(child))
    .filter((segment) => segment.original || segment.braille || segment.lines?.length || segment.children?.length);
}

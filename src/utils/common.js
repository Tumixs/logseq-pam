//@ts-check

import * as pdfjsLib from "pdfjs-dist";
import { loadPdfJs } from "./loadPdfJs.js";
import { PRODUCTION } from "../main.js";
import chroma from "chroma-js";

/**
 *
 * @param {import("pdfjs-dist").PDFPageProxy} page
 * @returns
 */
export function getPageSize(page) {
  const [x, y, w, h] = Reflect.get(page._pageInfo, "view");
  const width = w - x;
  const height = h - y;
  const rotate = Reflect.get(page._pageInfo, "rotate");
  // Consider rotation
  return rotate === 90 || rotate === 270
    ? PageSize(height, width)
    : PageSize(width, height);
}

/**
 *
 * @param {Number} width
 * @param {Number} height
 * @returns {PageSize}
 */
export function PageSize(width, height) {
  return { ":width": width, ":height": height };
}

/**
 * @param {{":highlights": LogseqHighlightAnnotation[]}|undefined} annotations
 * @param {String} pageName
 */
export async function creatMDContent(annotations, pageName) {
  let marker = "hls__";
  let MDContent = [];
  let highlights = annotations?.[":highlights"];
  if (!highlights) return;
  for (let highlight of highlights) {
    let content = `\
${highlight[":content"][":text"]}
  ls-type:: annotation
  hl-page:: ${highlight[":page"]}
  hl-color:: ${highlight[":properties"][":color"]}
  id:: ${highlight[":id #uuid"]}
  ${logseq.settings["diffMarker"]}:: true`;
    MDContent.push(content);
  }

  const hlsPage = marker.concat(pageName.replace(".md", ""));
  const pdfName = pageName.replace("md", "pdf");
  const hslExists = await logseq.Editor.getPage(hlsPage);
  if (logseq.settings["overWrite"] && hslExists) {
    await logseq.Editor.deletePage(hlsPage);
  }
  if (
    logseq.settings["checkDuplicate"] &&
    hslExists &&
    !logseq.settings["overWrite"]
  ) {
    const oldMDContent = await logseq.Editor.getPageBlocksTree(hlsPage);
    await removeMarkedBlocks(oldMDContent);
  }

  const createHLSEntity = async () => {
    const hlsEntity = await logseq.Editor.createPage(
      hlsPage,
      {
        file: `![${pdfName}](../assets/${pdfName})`,
        filepath: `(../assets/${pdfName})`,
      },
      {
        redirect: false,
        journal: false,
      }
    );
    if (!hlsEntity) throw new Error("failed to create HLS Markdown");
    return hlsEntity;
  };
  let mhlsPage = undefined;
  if (!hslExists) {
    mhlsPage = (await createHLSEntity()).name;

  } else {mhlsPage = hlsPage}
  for (let content of MDContent) {
    await logseq.Editor.appendBlockInPage(mhlsPage, content);
  }
}

/**
 *
 * @param {ArrayBuffer} pdfBuffer
 * @returns {Promise<{":highlights": LogseqHighlightAnnotation[]}| undefined>}
 */
export async function extractAnnotationsFromPDF(pdfBuffer) {
  try {
    await loadPdfJs();
  } catch (e) {
    logseq.UI.showMsg("Failed to load pdfjs-dist.", "error");
    console.error(e);
    return undefined;
  }
  const loadingTask = pdfjsLib.getDocument({ data: pdfBuffer });
  const allHighlights = loadingTask.promise.then(async (pdf) => {
    const pageHighlights = [];
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const annots = await page.getAnnotations();
      if (annots.length == 0) continue;
      let pageHighlight = [];
      pageHighlight = await getHighlightAnnotations(
        { pageNum: pageNum, pageSize: getPageSize(page) },
        annots
      );
      pageHighlights.push(...pageHighlight);
    }
    if (pageHighlights.length == 0) return;
    const allHighlights = { ":highlights": pageHighlights };
    return allHighlights;
  });
  return allHighlights;
}

/**
 *
 * @param {{pageNum: Number, pageSize:PageSize}} param0
 * @param {Array<any>} annots
 * @returns {Promise<Array<LogseqHighlightAnnotation>>}
 */
export async function getHighlightAnnotations({ pageNum, pageSize }, annots) {
  let highlights = [];
  for (const annot of annots) {
    if (annot.subtype !== "Highlight") continue;
    let color = detectColor(annot.color);
    let bounding = {
      ":x1": annot.rect[0],
      ":y1": pageSize[":height"] - annot.rect[3],
      ":x2": annot.rect[2],
      ":y2": pageSize[":height"] - annot.rect[1],
    }; //detectBounding 0, H - 3, 2, H - 1
    let highlight = {
      ":page": pageNum,
      ":properties": color,
      ":position": {
        ":bounding": { ...bounding, ...pageSize },
        ":rects": [{ ...bounding, ...pageSize }],
        ":page": pageNum,
      },
      ":content": { ":text": annot?.overlaidText },
      ":id #uuid": await logseq.Editor.newBlockUUID(),
      ":author": annot.titleObj.str,
    };
    highlights.push(highlight);
  }
  return highlights;
}

export const COLORS = {
  red: [255, 0, 0],
  green: [0, 255, 0],
  blue: [0, 0, 255],
  yellow: [255, 255, 0],
  purple: [128, 0, 128],
};
/**
 * Determine nearest color based on Delta-E difference
 * @param {Array|Uint8ClampedArray} color - RGB array [r, g, b] where values are 0-255
 * @returns {} Name of the nearest color
 */
export function detectColor(color) {
  // Convert Uint8ClampedArray to regular array if needed
  const rgbArray = Array.isArray(color) ? color : Array.from(color);
  const inputColor = chroma([rgbArray[0], rgbArray[1], rgbArray[2]]);
  const deltae = {};

  for (const [colorName, referenceColor] of Object.entries(COLORS)) {
    deltae[colorName] = chroma.deltaE(inputColor, referenceColor);
  }

  // Return color name with minimum delta-E
  const likelyColor = Object.keys(deltae).sort(
    (a, b) => deltae[a] - deltae[b]
  )[0];
  return { ":color": likelyColor };
}

/**
 *
 * @param {Error | null} error 
 * @param {string} msg defualt = warning
 * @param {string} level 'success' | 'warning' | 'error' | defualt = warning
 * @param {number} timeout default = 10000
 */
export const reportStatus = async (
  msg,
  level = "warning",
  error = null,
  timeout = 10000
) => {
  if (!PRODUCTION) console.error(msg + ":ErrorMsg" + error);
  if (msg) {
    logseq.UI.showMsg(msg, level, {
      timeout: timeout,
    });
  }
  return;
};

/**
 *
 * @param {{":highlights": LogseqHighlightAnnotation[]}| undefined} annotations
 * @returns {Promise<string>}
 *
 */
export const objToLogseqEDN = async (annotations) => {
  return JSON.stringify(annotations, null, 4).replace(/":([^"]+)":/g, ":$1");
};

/**
 *
 * @param {String} ednString
 * @returns
 */
export const logseqEDNToObj = (ednString) => {
  const jsonString = ednString.replace(/:(\w+(?:\s+#\w+)?)/g, '":$1":');
  return JSON.parse(jsonString);
};

/**
 *
 * @param {Array<import("@logseq/libs/dist/LSPlugin.user.js").BlockEntity>} oldMDContent
 */
async function removeMarkedBlocks(oldMDContent) {
  for (let block of oldMDContent) {
    if (!("properties" in block)) continue;
    if (logseq.settings["diffMarker"] in block.properties) {
      await logseq.Editor.removeBlock(block.uuid);
    }
  }
}

/**
 * Manual conversion: Rectangle to Quadpoints
 * @param {Array<number>} rect - Rectangle as [ulx uly lrx lry]
 * @returns {Array<number>} Quadpoints as [ulx uly urx ury llx lly lrx lry]
 */
export function rectToQuadpoints(rect) {
  const [x0, y0, x1, y1] = rect;
  return [[x0, y0, x1, y0, x0, y1, x1, y1]];
}

export async function getMarkedBlocks(pageName) {
  let marker = "hls__";
  let marked = [];
  const hlsPage = marker.concat(pageName.replace(".md", ""));
  const oldMDContent = await logseq.Editor.getPageBlocksTree(hlsPage);
  for (let block of oldMDContent) {
    if (!("properties" in block)) continue;
    if (logseq.settings["diffMarker"] in block.properties) {
      marked.push(block.properties.id);
    }
  }
  return marked;
}

/**
 * Scale a rectangle from one page size to another
 * @param {Array<number>} rect - Rectangle [x0, y0, x1, y1] in source coordinates
 * @param {Object} sourcePageSize - {:width, :height} of source page
 * @param {Object} targetPageSize - {:width, :height} of target page
 * @returns {Array<number>} Scaled rectangle in target coordinates
 */
export function scaleRect(rect, sourcePageSize, targetPageSize) {
  const [x0, y0, x1, y1] = rect;

  // Calculate scale factors
  const scaleX = targetPageSize[":width"] / sourcePageSize[":width"];
  const scaleY = targetPageSize[":height"] / sourcePageSize[":height"];

  return [x0 * scaleX, y0 * scaleY, x1 * scaleX, y1 * scaleY];
}

//@ts-check
import {} from "@logseq/libs";
import { parseEDNString } from "edn-data";
import * as mupdf from "../../node_modules/mupdf/dist/mupdf.js";
import {
  COLORS,
  getMarkedBlocks,
  PageSize,
  rectToQuadpoints,
  reportStatus,
  scaleRect,
} from "../utils/common";
import {
  getNewRelFileHandle,
  readFile,
  requestGraphDirectoryAccess,
  resolvePDFPath,
  writeFile,
} from "../utils/fs-util";
import { importAnnotations } from "./importAnnotations.js";

/**
 * 
 * @param {string} blockUuid 
 * @returns 
 */
export async function embedAnnotations(blockUuid) {
  const block = await logseq.Editor.getBlock(blockUuid, {
    includeChildren: false,
  });
  if (!block || !block.content) {
    reportStatus("Block not found or empty content.", "error");
    return;
  }

  const PDFPath = resolvePDFPath(block.content);
  if (!PDFPath) {
    reportStatus("Could not resolve PDF path from block content.", "error");
    return;
  }
  const fileName = PDFPath.pop();
  const graphHandle = await requestGraphDirectoryAccess();
  const assetHandle = await graphHandle?.getDirectoryHandle("assets", {
    create: false,
  });
  if (!assetHandle) {
    reportStatus("Assets directory not found in the graph..", "warning");
    return;
  }

  const currentEDNHandle = await getNewRelFileHandle(
    fileName?.replace("pdf", "edn"),
    assetHandle
  );
  const currentPDFHandle = await getNewRelFileHandle(fileName, assetHandle);
  if (!currentEDNHandle || !currentPDFHandle) {
    reportStatus(
      "Could not locate PDF. Please ensure the block content contains a valid relative path to a PDF file in the graph's assets folder.",
      "error"
    );
    return;
  }

  const ednBufferText = await readFile(currentEDNHandle, true);
  // const ednData = await logseqEDNToObj(ednBufferText);
  const ednData = parseEDNString(ednBufferText, {
    mapAs: "object",
    keywordAs: "string",
  });
  let annotations = ednData?.["highlights"];
  if (!annotations) {
    reportStatus("No recent annotations", "success");
    return;
  }
  let highlights = [];
  let marked = await getMarkedBlocks(currentPDFHandle.name.replace(".pdf", ""));
  for (let highlight of annotations) {
    if (marked.includes(highlight.id.val)) {
      continue;
    }
    let unMarked = {};
    unMarked.page = highlight.page;
    unMarked.author = highlight.author;
    let rectObj = highlight.position.rects.list[0];
    unMarked.pageSize = PageSize(rectObj.width, rectObj.height);
    unMarked.rect = [rectObj.x1, rectObj.y1, rectObj.x2, rectObj.y2];
    let colord = highlight.properties.color;
    unMarked.color = COLORS[`${colord}`].map((val) => val);
    highlights.push(unMarked);
  }

  if (highlights.length == 0) {
    reportStatus("No recent annotations", "success");
    return;
  }
  let status = true;
  const pdfBuffer = await readFile(currentPDFHandle).catch((error) => {
    reportStatus("Error reading the PDF file: ", "error", error);
    status = false;
  });
  const bakedPDF = await embedHighlights(highlights, pdfBuffer).catch(
    (error) => {
      reportStatus("Error creating the new annotations: ", "error", error);
      status = false;
      return;
    }
  );
  await writeFile(currentPDFHandle, bakedPDF, true).catch((error) => {
    reportStatus("Error writing a new PDF file: ", "error", error);
    status = false;
    return;
  });
  if (logseq.settings["export"]) {
    reportStatus("Choose where to save your embedded PDF", "success");
    const saveFilePicker = await window.showSaveFilePicker({
      suggestedName: currentPDFHandle.name,
      startIn: "downloads",
      types: [
        {
          description: "Portable Document Format",
          accept: { "application/pdf": [".pdf"] },
        },
      ],
    });
    await writeFile(saveFilePicker, bakedPDF, true).catch((error) => {
      reportStatus("Error writing a new PDF file: ", "error", error);
      status = false;
      return;
    });
  }
  if (status) {
    reportStatus(
      "Success embedded your annotations, will now try to reimport the annotations into logseq",
      "success"
    );
  }
  importAnnotations(blockUuid);
}

/**
 *
 * @param {Array<{}>} highlights
 * @param {ArrayBuffer} fileData
 * @depends on mupdf
 * @returns
 */
async function embedHighlights(highlights, fileData) {
  let document = mupdf.PDFDocument.openDocument(new Uint8Array(fileData));
  for (let highlight of highlights) {
    let page = document.loadPage(highlight.page - 1);
    const pageBounds = page.getBounds();
    const pageSize = PageSize(pageBounds[2], pageBounds[3]);
    const normalizedRects = scaleRect(
      highlight.rect,
      highlight.pageSize,
      pageSize
    );
    const normalizedQuads = rectToQuadpoints(normalizedRects);
    let annotation = page.createAnnotation("Highlight");
    annotation.setColor(highlight.color);
    if (highlight.author) {
      annotation.setAuthor(highlight.author);
    }
    annotation.setQuadPoints(normalizedQuads);
    annotation.update();
  }
  const buffer = document.saveToBuffer("incremental").asUint8Array();
  return buffer;
}

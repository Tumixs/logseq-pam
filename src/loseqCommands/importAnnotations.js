//@ts-check
import {} from "@logseq/libs";
import {
  getNewRelFileHandle,
  readFile,
  requestGraphDirectoryAccess,
  resolvePDFPath,
  writeFile,
} from "../utils/fs-util";
import {
  creatMDContent,
  extractAnnotationsFromPDF,
  objToLogseqEDN,
  reportStatus as reportStatus,
} from "../utils/common";

/**
 *Imports embedded annotations from a PDF file located in the current graphs assets directory.
 * @param {string} blockUuid
 * @return {Promise<undefined>}
 *
 * @note only highlight type annotations
 *
 * @BUG Operation is not idempotent
 */
export async function importAnnotations(blockUuid) {
  const block = await logseq.Editor.getBlock(blockUuid, {
    includeChildren: false,
  });
  if (!block || !block.content) {
    reportStatus("Block not found or empty content.", "error");
    return;
  }

  const PDFPath = resolvePDFPath(block.content);
  if (!PDFPath) {
    reportStatus(
      "Could not resolve PDF path from block content.",
      "error"
    );
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

  const currentPDFHandle = await getNewRelFileHandle(fileName, assetHandle);
  if (!currentPDFHandle) {
    reportStatus(
      "Could not locate PDF. Please ensure the block content contains a valid relative path to a PDF file in the graph's assets folder.",
      "error"
    );
    return;
  }

  const pdfBuffer = await readFile(currentPDFHandle);
  let annotations = await extractAnnotationsFromPDF(pdfBuffer);
  if (!annotations) return;
  const ednContent = await objToLogseqEDN(annotations);

  let status = true;
  const saveFileHandle = await assetHandle?.getFileHandle(
    currentPDFHandle.name.replace(".pdf", ".edn"),
    { create: true }
  );
  await writeFile(saveFileHandle, ednContent).catch((error) => {
    reportStatus("Error writing EDN file: ", error);
    status = false;
  });
  await creatMDContent(
    annotations,
    currentPDFHandle.name.replace(".pdf", ".md")
  ).catch((error) => {
    reportStatus("Error creating MD content: ", "error", error);
    status = false;
  });
  if (status) {
    const diffMarker = logseq.settings["diffMarker"];
    const marker = true;
    if (!(await logseq.Editor.getBlockProperty(blockUuid, diffMarker))){
    logseq.Editor.upsertBlockProperty(blockUuid, diffMarker, marker); //@todo::check that property already exist
    }
  }
  logseq.UI.showMsg(
    status ? `Import annotations from ${currentPDFHandle.name} successful!` : "Import failed.",
    status ? "success" : "error"
  );

  return;
}

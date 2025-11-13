//@ts-check
import {
  readFile,
  requestGraphDirectoryAccess,
  writeFile,
} from "../utils/fs-util";
import {
  creatMDContent,
  extractAnnotationsFromPDF,
  objToLogseqEDN,
  reportStatus as reportStatus,
} from "../utils/common";

/**
 * Uploads a PDF file to the current graphs assets directory and creates record of embedded annotations
 * @param {import("@logseq/libs/dist/LSPlugin.user").IHookEvent} block
 *
 * @note only supports highlight type annotations
 */
export async function uploadWithAnnotations(block) {
  const filePickers = await window.showOpenFilePicker({
    id: "filePicker",
    startIn: "downloads",
    types: [
      {
        description: "Portable Document Format",
        accept: { "application/pdf": [".pdf"] },
      },
    ],
    multiple: true,
  });
  const graphHandle = await requestGraphDirectoryAccess();
  const assetHandle = await graphHandle
    ?.getDirectoryHandle("assets", {
      create: false,
    })
    .catch((e) => {
      reportStatus(`Error could not locate the '/assets' directory. Is ${graphHandle.name} your local directory for this graph?`, "error", e);
      return;
    });
  if (!assetHandle) {
    reportStatus("could not locate the assets directory", "error");
    return;
  }
  let prevBlock = block;
  for (const filePicker of filePickers) {
    const pdfName = filePicker.name
      .replace(".pdf", "_")
      .concat(Date.now())
      .concat(".pdf");

      let pdfHandle = undefined;
    try {
      pdfHandle = await assetHandle?.getFileHandle(pdfName, {
        create: true,
      });
    } catch (e) {
      reportStatus(`Error cannot create ${filePicker.name}`, "error", e);
      continue;
    }

    const PDFBuffer = await readFile(filePicker);
    await writeFile(pdfHandle, PDFBuffer);
    const url = `![${pdfName}](../assets/${pdfName})`;
    await logseq.Editor.updateBlock(prevBlock.uuid, url).catch((e) =>
      console.log(e)
    );
    let customUUID = await logseq.Editor.newBlockUUID();
    let nextBlock = await logseq.Editor.insertBlock(prevBlock.uuid, "", {
      before: false,
      sibling: true,
      isPageBlock: false,
      customUUID: customUUID,
    }).catch((e) => console.log(e));

    const annotations = await extractAnnotationsFromPDF(PDFBuffer);
    if (!annotations) {
      reportStatus("No existing Annotation in the PDF", "sucess");
      return;
    }
    let status = true;
    const ednHandle = await assetHandle?.getFileHandle(
      pdfName.replace(".pdf", ".edn"),
      { create: true }
    );
    creatMDContent(annotations, pdfName.replace(".pdf", ".md")).catch(
      (error) => {
        reportStatus("Error creating MD content: ", "error", error);
        status = false;
      }
    );
    const ednContent = await objToLogseqEDN(annotations);
    writeFile(ednHandle, ednContent).catch((error) => {
      reportStatus("Error writing EDN file: ", "error", error);
      status = false;
    });
    if (status) {
      const diffMarker = logseq.settings["diffMarker"];
      const marker = true;
      await logseq.Editor.upsertBlockProperty(
        prevBlock?.uuid,
        diffMarker,
        marker
      ).then(() => (prevBlock = nextBlock));
    }
    await logseq.UI.showMsg(
      status
        ? `Import annotations from ${pdfName} successful!`
        : "Import failed.",
      status ? "success" : "error"
    );
  }
}

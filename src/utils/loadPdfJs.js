import * as pdfjsLib from "pdfjs-dist";

export async function loadPdfJs() {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "./vendor/pdf.worker.min.mjs";
  return new Promise((resolve, reject) => {
    if (window.pdfjsLib && pdfjsLib.GlobalWorkerOptions.workerSrc) {
      resolve(window.pdfjsLib);
      return;
    }
    const script = document.createElement("script");
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.onload = () => {
      // Set worker
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      resolve(window.pdfjsLib);
      logseq.UI.showMsg("Loaded pdfjs-dist successfully!", "success");
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

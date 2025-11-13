//@ts-check

/**
 *
 * @param {FileSystemFileHandle | undefined} fileHandle
 * @param {ArrayBuffer | String} contents
 * @param {boolean} baking=false
 */
export async function writeFile(fileHandle, contents, baking=false) {
  if (!fileHandle) return;
  if (!(await verifyPermission(fileHandle))) {
    return;
  }
  let writable = undefined;
  if (logseq.settings["overWrite"] || baking) {
    writable = await fileHandle.createWritable();
  } else {
    writable = await fileHandle.createWritable({
      keepExistingData: true,
    });
  }
  await writable.write(contents);
  await writable.close();
}

/**
 *
 * @param {FileSystemFileHandle} fileHandle
 * @returns
 */
export async function readFile(fileHandle, text=false) {
  if (!(await verifyPermission(fileHandle))) {
    return;
  }
  const file = await fileHandle.getFile();
  if (text) {const contents = file.text(); return contents;}
  const contents = await file.arrayBuffer();
  return contents;
}

/**
 *
 * @returns {Promise<FileSystemDirectoryHandle | undefined>}
 */
export const requestGraphDirectoryAccess = (function () {
  let dirHandle = undefined; //Stores handle in closure/namespace
  return async function () {
    if (dirHandle) return dirHandle;
    const permit = confirm("Open your Graph directory to grant access");
    if (permit) {
      dirHandle = await window
        //@ts-expect-error
        .showDirectoryPicker({
          mode: "readwrite",
          startIn: "documents",
        })
        //@ts-expect-error
        .catch((e) => {
          logseq.UI.showMsg("Directory access cancelled.", "error", {
            timeout: 5000,
          });
          console.error(e);
          return;
        });
      return dirHandle;
    } else {
      logseq.UI.showMsg("File access permission denied.", "error", {
        timeout: 5000,
      });
      return;
    }
  };
})();
//@ts-check
/**
 *
 * @param {string[]} filePath
 * @param {FileSystemDirectoryHandle | undefined} graphHandle
 * @returns {Promise<PDFHandle | undefined>}
 * @UNUSED
 */
export async function searchFileInGraph(filePath, graphHandle) {
  const fileName = filePath.pop();
  // const assetPath = logseq.Assets.makeUrl(fileName);
  let currentHandle = graphHandle;
  for (const dirName of filePath) {
    if (dirName === "" || dirName === ".") continue;
    currentHandle = await currentHandle
      ?.getDirectoryHandle(dirName, {
        create: false,
      })
      .catch((e) => {
        logseq.UI.showMsg(
          `Directory ${dirName} not found in graph ${currentHandle?.name}.`,
          "error"
        );
        console.error(e);
        return undefined;
      });
    if (!currentHandle) {
      return;
    }
  }

  if (fileName) {
    const fileHandle = await getNewRelFileHandle(fileName, currentHandle);
    return { parent: currentHandle, fileHandle: fileHandle };
  } else return;
}

/**
 *
 * @param {string | undefined} fileName
 * @param {FileSystemDirectoryHandle | undefined} parent
 * @returns {Promise<FileSystemFileHandle | undefined>}
 */
export async function getNewRelFileHandle(fileName, parent) {
  if (!fileName) return;
  const fileHandle = await parent
    ?.getFileHandle(fileName, {
      create: false,
    })
    .catch((error) => {
      logseq.UI.showMsg(
        `File ${fileName} not found in the ${parent.name} folder.`,
        "error"
      );
      console.error(error);
      return undefined;
    });
  return fileHandle;
}

/**
 *
 * @param {string} blockContent
 * @returns {string[] | undefined}
 *
 * @note Gets only the first link, when there are multiple links in the block
 */
export function resolvePDFPath(blockContent) {
  const matchArray = blockContent.match(/\]\(([^)]+\.pdf)/);
  const match = matchArray?.[1];
  const fullPath = match?.split("/");
  return fullPath;
}

/**
 *
 * @param {FileSystemHandle} fileHandle
 * @returns
 */
async function verifyPermission(fileHandle) {
  const opts = {};

  opts.mode = "readwrite";
  if ((await fileHandle.queryPermission(opts)) === "granted") {
    return true;
  }
  if ((await fileHandle.requestPermission(opts)) === "granted") {
    return true;
  }
  return false;
}

//@ts-check
import { embedAnnotations } from "./loseqCommands/embedAnnotations";
import { importAnnotations } from "./loseqCommands/importAnnotations";
import { uploadWithAnnotations } from "./loseqCommands/uploadWithAnnotations";
import { EMBED, PRODUCTION } from "./main";

export function registerLogseqCommands() {
  logseq.Editor.registerBlockContextMenuItem(
    "PAM: Import PDF Annotations",
    async (block) => {
      importAnnotations(block.uuid);
    }
  );

  logseq.Editor.registerSlashCommand(
    "PAM: Upload PDF with Annotations",
    async (block) => {
      uploadWithAnnotations(block);
    }
  );
  if (EMBED){     //@todo do not include the mupdf wasm if !EMBED
  logseq.Editor.registerBlockContextMenuItem(
    "PAM: Embed PDF Annotations",
    async (block) => {
      embedAnnotations(block.uuid);
    }
  );}
  if (!PRODUCTION) {
    logseq.Editor.registerBlockContextMenuItem("PAM: log block", async (e) => {
      console.log(await logseq.Editor.getBlock(e.uuid));
    });
  }
}

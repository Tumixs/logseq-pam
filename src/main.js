//@ts-check
import "@logseq/libs";
import { registerLogseqCommands } from "./registerLogseqCommands.js";
import { registerSettingsUI } from "./ui/registersettingsUI.js";
export const PRODUCTION = true;
export const EMBED = true;


function main() {
  registerSettingsUI();
  registerLogseqCommands();
}

 logseq.ready(main)





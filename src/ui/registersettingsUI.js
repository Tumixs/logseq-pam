//@ts-check

/**
 * @type Array<import("@logseq/libs/dist/LSPlugin.user").SettingSchemaDesc>
 */
let settingsUI = [
  {
    key: "diffMarker",
    type: "string",
    default: "pam",
    title: "Your Marker",
    description:
      "Enter your marker to identify PDFs whose annotations have been imported. The marker is appended to the file name e.g pam_hello.pdf. This marker is also used to check for duplicates, ensure the marker is always set to some value if you plan to check for duplicates",
  },
  {
    key: "checkDuplicate",
    type: "boolean",
    default: true,
    title: "Check for Duplicate or Stale Annotation records",
    description:
      "Removes existing annotations that have the marker as a property",
  },
  {
    key: "overWrite",
    type: "boolean",
    default: false,
    title: "Overwrite existing logseq annotation when importing.",
    description:
      "`Caution!!` This has the effect of deleting all highlights you created using the builtin logseq PDF reader. Only annotations embedded in your PDF will be available after the operation.",
  },
  {
    key: "export",
    type: "boolean",
    default: false,
    title: "Export embedded annotation to external file",
    description: "Will prompt for where to store the the embedded pdf",
  },
  {
    key: "allAsHighlights",
    type: "boolean",
    default: false,
    title: "Import all annotations as highlights",
    description:
      "`EXPERIMENTAL, Has no Effect` Will import underlines as highlights. `This is a planned feature`",
  },
];

export function registerSettingsUI() {
  logseq.useSettingsSchema(settingsUI);
}

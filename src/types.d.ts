type LogseqHighlightAnnotation = {
  ":page": number;
  ":properties": { ":color": string };
  ":position": {
    ":bounding": {
      ":x1": number;
      ":y1": number;
      ":x2": number;
      ":y2": number;
      ":width": number;
      ":height": number;
    };
    ":rects": Array<{
      ":x1": number;
      ":y1": number;
      ":x2": number;
      ":y2": number;
      ":width": number;
      ":height": number;
    }>;
    ":page": number;
  };
  ":content": { ":text": string };
  ":id #uuid": string;
  ":author": string;
};



type PageSize = { ":width": number; ":height": number };

type PDFHandle = {
  parent: FileSystemDirectoryHandle | undefined | null;
  fileHandle: FileSystemFileHandle | null | undefined;
} | null;

importScripts("./lib/jszip.min.js");

const CHUNK_SIZE = 1024 * 256; // 256KB

function transmitFileInChunks(blob, port) {
  // https://stackoverflow.com/questions/25668998/how-to-pass-a-blob-from-a-chrome-extension-to-a-chrome-app
  let start = 0;
  let end = CHUNK_SIZE;
  const remainder = blob.size % CHUNK_SIZE;
  let numChunks = Math.floor(blob.size / CHUNK_SIZE);
  if (remainder > 0) {
    numChunks += 1;
  }
  let chunkIndex = 0;

  const reader = new FileReader();
  reader.onload = function () {
    const message = {
      blobString: reader.result,
      mimeString: "application/zip",
      chunks: numChunks,
    };
    port.postMessage(message);

    processChunk();
  };
  reader.onerror = function (error) {
    console.error(error);
  };
  processChunk();

  function processChunk() {
    chunkIndex++;

    if (chunkIndex > numChunks) {
      // Done
      return;
    }

    if (chunkIndex == numChunks && remainder != 0) {
      end = start + remainder;
    }

    const blobChunk = blob.slice(start, end);

    start = end;
    end = end + CHUNK_SIZE;

    reader.readAsBinaryString(blobChunk);
  }
}

chrome.runtime.onConnect.addListener((port) => {
  console.assert(port.name === "courtlistener-download");
  port.onMessage.addListener((request) => {
    if (request.downloads) {
      const { folder, downloads } = request;
      const zipFolder = new JSZip().folder(folder);
      const promises = [];

      // Asynchronously download each file, rename, and zip in a folder
      for (const download of downloads) {
        promises.push(
          fetch(download.url)
            .then((resp) => {
              if (resp.status === 200 || resp.status === 0) {
                return Promise.resolve(resp.arrayBuffer());
              } else {
                return Promise.reject(new Error(response.statusText));
              }
            })
            .then((contents) => zipFolder.file(download.filename, contents))
            .catch((error) => {
              console.error(error);
            })
        );
      }

      // Return full zip once downloads are done
      Promise.all(promises)
        .then(() => zipFolder.generateAsync({ type: "blob" }))
        .then((zipped) => {
          transmitFileInChunks(zipped, port);
        });
    } else if (request.url) {
      chrome.downloads
        .download({
          url: request.url,
          filename: `${request.folder}.zip`,
        })
        .then(() => {
          port.disconnect();
        });
    }
  });
});

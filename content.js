const rows = document.querySelectorAll('[id^="entry-"]');

const getCourtListenerCaseName = () => {
  const caseName = document.querySelector("h1");
  if (caseName) {
    const text = caseName.textContent.trim().split("(");
    return text[0].trim();
  }
  return "Unknown case";
};

const getPacerCaseName = () => {
  const caseNameEl = document.querySelector("table tr:first-child td:nth-child(3)");
  if (caseNameEl && caseNameEl.textContent) {
    return caseNameEl.textContent.trim();
  } else {
    return "Download";
  }
};

const downloadAll = (folder, downloads) => {
  let _chunkIndex = 0;
  let _blobs = [];
  let mergedBlob;
  const port = chrome.runtime.connect({ name: "courtlistener-download" });

  port.postMessage({ folder, downloads });

  // Prepare for response
  port.onMessage.addListener(function (request) {
    if (request.blobString) {
      _chunkIndex++;

      let bytes = new Uint8Array(request.blobString.length);
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = request.blobString.charCodeAt(i);
      }
      _blobs[_chunkIndex - 1] = new Blob([bytes], { type: request.mimeString });

      if (_chunkIndex === request.chunks) {
        for (let i = 0; i < _blobs.length; i++) {
          if (i === 0) {
            mergedBlob = new Blob([_blobs[i]], { type: request.mimeString });
          } else {
            mergedBlob = new Blob([mergedBlob, _blobs[i]], { type: request.mimeString });
          }
        }

        // Create download URL
        var url = URL.createObjectURL(mergedBlob);
        port.postMessage({ url, folder });
      }
    }
  });
};

const courtListener = () => {
  const caseName = getCourtListenerCaseName();
  for (let row of rows) {
    const docketEntry = row.id.split("-")[1];
    const recapDocuments = row.querySelectorAll(".recap-documents");

    // Don't need to add a button if there's <=1 PDF for the row
    if (row.querySelectorAll(".recap-documents:has(a.btn-primary)").length > 1) {
      // Add row with button to download all
      const newRow = document.createElement("div");
      newRow.classList.add("row", "recap-documents");

      // Make button wrappers
      const bigButtonHolder = document.createElement("div");
      const smallButtonHolder = document.createElement("div");
      bigButtonHolder.classList.add(
        "hidden-xs",
        "col-sm-4",
        "col-sm-offset-8",
        "col-md-3",
        "col-md-offset-9",
        "hidden-print"
      );
      smallButtonHolder.classList.add(
        "col-xs-3",
        "col-xs-offset-9",
        "hidden-sm",
        "hidden-md",
        "hiden-lg",
        "hidden-print"
      );

      // Make buttons
      const bigButton = document.createElement("button");
      bigButton.classList.add("btn", "btn-success", "btn-xs");
      bigButton.style.marginBottom = "8.5px";
      bigButton.title = "Download all PDFs";
      bigButton.innerText = "Download all PDFs";

      const smallButton = document.createElement("button");
      smallButton.classList.add("btn", "btn-success", "btn-xs");
      smallButton.style.marginBottom = "8.5px";
      smallButton.title = "Download all PDFs";
      const icon = document.createElement("i");
      icon.classList.add("fa", "fa-file-zip-o");
      smallButton.append(icon);

      // On click, download all PDFs
      for (let button of [bigButton, smallButton]) {
        button.addEventListener("click", () => {
          const downloads = [];
          for (let documentRow of recapDocuments) {
            const cols = documentRow.querySelectorAll(":scope > div");

            // Get link element and extract name
            const linkEl = cols[0].querySelector("a");
            // If there's a link, we can do the download.
            // Otherwise, the document isn't on CourtListener
            if (linkEl) {
              const linkText = linkEl.textContent.trim();
              const description = cols[1].textContent.trim();
              // Get direct download link (link href is an embedded PDF)
              const directLink = cols[3].querySelector("a.btn-primary").href;
              downloads.push({
                url: directLink,
                filename: `${linkText} - ${description}.pdf`,
              });
            }
          }
          if (downloads.length) {
            const folder = `${caseName} ${docketEntry}`;
            downloadAll(folder, downloads);
          }
        });
      }

      bigButtonHolder.append(bigButton);
      smallButtonHolder.append(smallButton);
      newRow.append(bigButtonHolder, smallButtonHolder);
      recapDocuments[recapDocuments.length - 1].after(newRow);
    }
  }
};

const pacer = () => {
  const recapLinks = document.querySelectorAll(".recap-inline");
  const caseName = getPacerCaseName();

  if (recapLinks.length > 1) {
    const button = document.createElement("button");
    button.innerText = "Download all PDFs from CourtListener";

    // On click, download all PDFs
    button.addEventListener("click", (e) => {
      e.preventDefault();
      const downloads = [];
      const rowsWithLink = document.querySelectorAll("table tr:has(a.recap-inline)");
      for (let i = 0; i < rowsWithLink.length; i++) {
        const documentRow = rowsWithLink[i];
        const cols = documentRow.querySelectorAll("td");

        // Get document name
        let filename;
        if (i === 0) {
          // The first document is the main document and doesn't have a name
          filename = "Main";
        } else {
          filename = cols[2].textContent.trim();
        }
        if (filename === "") {
          filename = `Document ${i + 1}`;
        }

        const directLink = documentRow.querySelector("a.recap-inline").href;
        downloads.push({
          url: directLink,
          filename: `${filename}.pdf`,
        });
      }
      if (downloads.length) {
        downloadAll(caseName, downloads);
      }
    });

    document.querySelector("table tr:last-child td:first-child").append(button);
  }
};

if (location.hostname.includes("courtlistener.com")) {
  courtListener();
} else if (location.hostname.includes("uscourts.gov")) {
  setTimeout(() => {
    pacer();
  }, 1000);
}

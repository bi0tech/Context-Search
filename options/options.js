function saveOptions(e) {
  if (document.querySelector("#makeNewTabActive").checked) {
    makeNewTabActive = "true";
  }
  else {
    makeNewTabActive = "false";
  }

  browser.storage.local.set({
    makeNewTabActive: makeNewTabActive
  });
  e.preventDefault();
}

function getOptions() {
  localize();
  let gettingOptions = browser.storage.local.get();

  gettingOptions.then((response) => {
    if (response.makeNewTabActive == "false") {
      document.getElementById("makeNewTabActive").checked = false;
    }
    else {
      document.getElementById("makeNewTabActive").checked = true;
    }
  });
}

function localize() {
  let getNode = document.getElementsByClassName("l10n");
  for (let i = 0; i < getNode.length; i++) {
    let node = getNode[i];
    let msg = node.textContent;
    node.firstChild.nodeValue = browser.i18n.getMessage(msg);
  }
}


function selectedFile(e) {
    var baseFolder = "Searches";

    try {
        let file = e.target.files[0];
        const fileReader = new FileReader();
        
        fileReader.onload = function (e) {
            // TODO: throw up wait spinner
            let rawFile = new Uint8Array(fileReader.result);
            rawFile = rawFile.slice(12);  //assume mozlz4 here
            let Buffer = require('buffer').Buffer;
            
            let LZ4 = require('lz4');
            rawFile = Buffer.from(rawFile);

            // buffer setup using length * max compression for lz4, better alternative?
            let uncompressedFile = new Buffer(rawFile.length * 255);
            let uncompressedSize = LZ4.decodeBlock(rawFile, uncompressedFile);

            //trim buffer to actual data length
            uncompressedFile = new Uint8Array(uncompressedFile.buffer.slice(0, uncompressedSize));
            
            //decode and parse to JSON data
            let textFile = new TextDecoder().decode(uncompressedFile);
            let enginesJSON = JSON.parse(textFile);
            
            // create base folder if it doesn't exist, set folderId to target folder
            let folderId = browser.bookmarks.search({title: baseFolder}).then((bookmarkArray) => {
                            if (bookmarkArray.length < 1) {
                                return browser.bookmarks.create({title: baseFolder}).then((folderNode) => {
                                    return Promise.resolve(folderNode.id); });
                            }
                            else {
                                return Promise.resolve(bookmarkArray[0].id);
                            }
            });
            // after folderid is processed, make the bookmarks
            folderId.then((parent) => {
                for (var engine of enginesJSON.engines) { 
                    for (var url of engine._urls) { 
                        if (typeof(url.type) == "undefined") {
                            let parmList = "";
                            for (var parm of url.params) {
                                parmList += parm.name + "=" + parm.value + "&";
                            }
                            engineUrl = (url.template + "?" + parmList).replace("{searchTerms}","%s");
                            browser.bookmarks.create({title: "Context-" + engine._name, url: engineUrl, parentId: parent});
                            console.log(engine._name + " -- " + engineUrl); 
                        } 
                    } 
                }        
            });
            // TODO: remove wait spinner
        }
        
        fileReader.readAsArrayBuffer(file);
        
    } catch (e) {
        console.log("Failed to open file");
    }
}

function readFileAsArrayBuffer(file) {
        return new Promise(resolve => {
            const fileReader = new FileReader();

            fileReader.addEventListener('loadend', event => {
                resolve(event.target.result);
            });
            fileReader.readAsArrayBuffer(file);
        });
}

openFile = document.querySelector('#openFile');
openFile.addEventListener('change', selectedFile);

document.addEventListener('DOMContentLoaded', getOptions);
document.querySelector("#makeNewTabActive").addEventListener("change", saveOptions);

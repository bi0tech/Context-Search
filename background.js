// Define root folder for searches
const FOLDER_NAME = "Searches"
const ILLEGAL_PROTOCOLS = ["chrome", "javascript", "data", "file", "about"]

var browserVersion = 0;

// Get browser version for backwards compatibility
function parseBrowserInfo(info){
  browserVersion = parseInt(info.version.split(".")[0]);
}

// Error logging
function onCreated(n) {
  if (browser.runtime.lastError) {
    console.log(`Error: ${browser.runtime.lastError}`);
  }
}

function onError(error) {
  console.log(`Error: ${error}`);
}

// Get ID of FOLDER_NAME and the object and pass everything through listBookmarksInTree:
function main() {
  let gettingRootFolder = browser.bookmarks.search({title: FOLDER_NAME});
  gettingRootFolder.then((bookmarks) => {
    if (bookmarks.length > 0) {
      let subTreeID = bookmarks[0].id;

      let gettingSubTree = browser.bookmarks.getSubTree(subTreeID);
      gettingSubTree.then((bookmarkItems) => {
        if (bookmarkItems[0].children.length > 0) {
          listBookmarksInTree(bookmarkItems[0], subTreeID);
        }

        // No root folder found: Show "Getting Started" help link
        else {
          createHelpLink();
        }
      });
    }

    // No root folder found: Show "Getting Started" help link
    else {
      createHelpLink();
    }
  });
}

// Parse through all bookmarks in tree and fire populateContextMenu for each:
function listBookmarksInTree(bookmarkItem, subTreeID) {
  populateContextMenu(bookmarkItem.id, bookmarkItem.title, bookmarkItem.url, bookmarkItem.parentId, bookmarkItem.type, subTreeID);

  if (bookmarkItem.children) {
    for (child of bookmarkItem.children) {
      listBookmarksInTree(child, subTreeID);
    }
  }
}

function reGenerateList() {
  let removingContextMenu = browser.contextMenus.removeAll();
  removingContextMenu.then(main);
}

function checkValid(url) {
  let isValidProtocol = false, isValidWildcard = false, isValid = false;

  // Check that URL is not privileged according to
  // https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/tabs/create
  if (url.indexOf(":") > -1) {
      protocol = url.split(":")[0];
      isValidProtocol = !ILLEGAL_PROTOCOLS.includes(protocol);
  }

  // Check that URL is a keyword search (i.e. containing "%s")
  //TODO: add list of check strings
  
  //if (url.indexOf("%s") > -1) {
      isValidWildcard = true;
  //}

  if (isValidProtocol && isValidWildcard) {
    isValid = true;
  }
  else {
    console.warn(`Non-conforming url: ${url}. Illegal protocol or missing \"%s\".`);
  }

  return isValid;
}

function makeFavicon(url) {
  var protocol, hostname, faviconUrl;

  if (url.indexOf("://") > -1) {
      protocol = url.substr(0, url.indexOf("://") + 3);
      hostname = url.split('/')[2];
  }

  faviconUrl = "https://www.google.com/s2/favicons?domain=" + protocol + hostname;

  return faviconUrl;
}


// Show a "Getting Started" link in the context menu if not set up properly
function createHelpLink() {
  browser.contextMenus.create({
    id: "https://github.com/NumeriusNegidius/Context-Search/wiki",
    title: browser.i18n.getMessage("helpMenuLabel"),
    contexts: ["all"],
    onclick: goTo
  }, onCreated());
}

// Make the context menu
function populateContextMenu(id, title, url, parent, type, subTreeID) {

  if (id == subTreeID) {
    //This is the root folder, make the title what is searched for
    browser.contextMenus.create({
      id: subTreeID,
      title: browser.i18n.getMessage("rootMenuLabel") + ": %s",
      contexts: ["selection"]
    }, onCreated());
  }
  else {

    if (!url) {
      // These are the folders
      browser.contextMenus.create({
        parentId: parent,
        id: id,
        title: title,
        icons: {
          16: "icons/folder.svg"
        }
      }, onCreated());
    }

    else {
      if (type == "separator") {
        // These are the separators
        browser.contextMenus.create({
          parentId: parent,
          id: id,
          type: "separator"
        }, onCreated());
      }

      if (url && title) {
        // These are the bookmarks with favicons
        let enabled = checkValid(url);
        let favicon = "";
        favicon = makeFavicon(url);
        browser.contextMenus.create({
          parentId: parent,
          id: url,
          title: title,
          icons: {
            16: favicon
          },
          enabled: enabled,
          onclick: goTo
        }, onCreated());
      }
    }

  }
}

// Check options if tab should open as active or in background
// Then pass to createTab
function goTo(info, parentTab) {
  let gettingItem = browser.storage.local.get();
  gettingItem.then((response) => {
    if (response.makeNewTabActive == "false") {
      active = false;
    }
    else {
      active = true;
    }

    openerTabId = parentTab.id;
    let myinfo = varReplace(info);
    
    //createTab(info, active, openerTabId);
    browser.tabs.create({
        url: myinfo,
        active: active,
        openerTabId: openerTabId
    });
  });
}

// Replace search vars [%s, %d, %0..%9] with
// the selected text and originating page domain
function varReplace(info) {
  let infoArray = info.selectionText.split(/[ ]+/);
  
  //standard %s replace with full string
  let myinfo = info.menuItemId.replace("%s", encodeURIComponent(info.selectionText));
  
  // %d replace with originating domain
  myinfo = myinfo.replace("%d", encodeURIComponent(info.pageUrl.split('/')[2]));
  
  // word by word replace using %0..%9
  for (var i=0; i < infoArray.length; i++) {
        myinfo = myinfo.replace("$" + i.toString(), encodeURIComponent(infoArray[i]));
  }
  
  // remove %0..%9 vars exceeding word length of selection text
  for (var i=infoArray.length; i<10; i++) {
        myinfo = myinfo.replace("$" + i.toString(), "");
  }
  
  return myinfo;
}

browser.runtime.getBrowserInfo().then(parseBrowserInfo);
browser.bookmarks.onCreated.addListener(reGenerateList);
browser.bookmarks.onRemoved.addListener(reGenerateList);
browser.bookmarks.onChanged.addListener(reGenerateList);
browser.bookmarks.onMoved.addListener(reGenerateList);

main();

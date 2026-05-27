chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ 
    id: "summary", 
    title: "Summarize with Helper AI", 
    contexts: ["selection"] 
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.selectionText && info.menuItemId === "summary") {
    chrome.storage.local.set({ contextText: info.selectionText });
  }
});

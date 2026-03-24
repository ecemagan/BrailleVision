chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "translateToBraille",
        title: "Seçili Metni Braille'a Çevir",
        contexts: ["selection"]
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "translateToBraille") {
        const selectedText = info.selectionText;
        chrome.tabs.sendMessage(tab.id, { action: "translate", text: selectedText });
    }
});

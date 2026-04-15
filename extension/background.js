chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "translateMathToBraille",
        title: "Translate math to Nemeth Braille",
        contexts: ["selection"]
    });
    chrome.contextMenus.create({
        id: "translateTextToBraille",
        title: "Translate text to Braille",
        contexts: ["selection"]
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "translateMathToBraille") {
        chrome.tabs.sendMessage(tab.id, { action: "translateMath", text: info.selectionText });
    } else if (info.menuItemId === "translateTextToBraille") {
        chrome.tabs.sendMessage(tab.id, { action: "translateAlpha", text: info.selectionText });
    }
});

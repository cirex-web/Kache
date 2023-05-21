import { logger } from "../logger";
import { Site, translatorSites } from "./site";
import { processCurrentSnapshot } from "./snapshotProcessing";
import { onLocationChange, getURL } from "./urlMonitor";

let existingMatchedSite: Site | null = null;
let lastClickTime = 0;
const getMatchingTranslatorConfig = (): Site | null => {
    const url = getURL();
    for (const site of translatorSites) {
        if (site.matchURL(new URL(url))) return site;
    }
    return null;
}


const takeSnapshot = (event?: Event) => {

    if (existingMatchedSite === null) {
        return;
    }
    const target = event?.target;
    const newInputText = (target instanceof HTMLTextAreaElement) ? target.value : (target instanceof HTMLElement ? target.textContent : null);

    processCurrentSnapshot(existingMatchedSite.getTranslationSnapshot(newInputText)); //snapshot right before UI components (like the textbox) change
}

window.addEventListener("blur", () => takeSnapshot());

window.addEventListener("click", (ev) => {
    if (Date.now() - lastClickTime > 20) {
        //intercept click
        console.log(Date.now() - lastClickTime);
        // ev.stopImmediatePropagation();
        const target = ev.target as HTMLElement;
        takeSnapshot();
        lastClickTime = Date.now();
        // target?.click();
    }
}, true);

onLocationChange(() => {

    const matchedSite = getMatchingTranslatorConfig();
    if (matchedSite !== existingMatchedSite) {
        if (existingMatchedSite !== null) {
            //remove existing event listeners if possible
            existingMatchedSite.getTextbox()?.removeEventListener('input', takeSnapshot);
        }
        if (matchedSite !== null) {
            logger.info(`Listening for activity in text box on site ${matchedSite}`)
            matchedSite.getTextbox()?.addEventListener('input', takeSnapshot);

        } else {
            logger.info("No site configurations found")
        }
        existingMatchedSite = matchedSite;
    }
});

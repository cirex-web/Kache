import { logger } from "../logger";
import { ChromeStorage } from "../../utils/storage/storage";
import { ITranslationSnapshot } from "../types";
import { requestParsers } from "./requestParser";
import { Card, Folder, Filter } from "../../types/storageTypes";
import { similar } from "../../utils/strings";
import { nanoid } from "nanoid";
import ISO6391 from 'iso-639-1';
import { getDestinationFolders } from "./filter";
import { addAlarm, makeHiddenCardFolder, preloadHTML, uploadStorage } from "./alarms";


logger.info("WordKache background script init!")

let currentWebRequest: {
    id: string,
    input: string,
    timeCompleted?: number //undefined if it's not completed 
} = {
    "id": "",
    "input": "",
} //current singular request (assuming that you wouldn't be translating on multiple sites at the same exact time)
chrome.webRequest.onBeforeRequest.addListener((request) => {
    for (const requestParser of requestParsers) {
        if (requestParser.match(request.url)) {
            currentWebRequest = requestParser.parseRequest(request);
            logger.debug("Initialized request", currentWebRequest);
        }
    }
}, {
    urls: ["http://*/*",
        "https://*/*"]
}, ["requestBody"]);
chrome.webRequest.onCompleted.addListener((request) => {
    if (request.requestId === currentWebRequest.id && !currentWebRequest.timeCompleted) { //older requests don't matter
        currentWebRequest.timeCompleted = +new Date();
        logger.debug("Completed request", currentWebRequest);
    }
}, {
    urls: ["http://*/*",
        "https://*/*"]
});


const addFlashcard = async (snapshot: ITranslationSnapshot) => {
    // NOTE: most recent cards are at the end of the array (it is assumed for now)
    const cards: Card[] = (await ChromeStorage.get("cards") as Card[] ?? []);
    const filters: Filter[] = (await ChromeStorage.get("filters") as Filter[] ?? []);



    for (let i = cards.length - 1; i >= 0; i--) {
        if (cards[i].location !== "root") continue;
        const isOldCard = snapshot.inputTime - cards[i].timeCreated >= 30 * 1000; //some arbitrary cutoff point for similarity checking

        //exact match? definitely don't need it
        if (cards[i].front.text === snapshot.inputText || (!isOldCard && similar(cards[i].front.text, snapshot.inputText))) {
            cards.splice(i, 1);
            break; //why would you want to overwrite anything extra?
        }
    }

    getDestinationFolders(snapshot, filters).forEach((dest) => {
        cards.push({
            front: {
                text: snapshot.inputText,
                lang: snapshot.inputLang
            }, back: {
                text: snapshot.outputText,
                lang: snapshot.outputLang
            },
            id: nanoid(),
            location: dest,
            timeCreated: snapshot.inputTime,
            source: snapshot.source,
        });
    });

    logger.info("Adding snapshot", snapshot);

    await ChromeStorage.setPair("cards", cards);
}
const getLangCode = (lang: string) => {
    lang = lang.toLowerCase();
    const langCode: string = ISO6391.validate(lang) ? lang : ISO6391.getCode(lang); //if it's already the code you don't have to do anything
    if (langCode === "") {
        logger.warn(`Unsupported language ${lang}`);
        return lang; //we'll just preserve this value for now... 
    }
    return langCode;
}


chrome.runtime.onConnect.addListener(
    function (port) {
        if (port.name === "snapshot") {
            port.onMessage.addListener(function (translationSnapshot: ITranslationSnapshot) {
                translationSnapshot.inputLang = getLangCode(translationSnapshot.inputLang);
                translationSnapshot.outputLang = getLangCode(translationSnapshot.outputLang);

                if (translationSnapshot.validated || (currentWebRequest.input === translationSnapshot.inputText && currentWebRequest.timeCompleted && +new Date() - currentWebRequest.timeCompleted >= 200)) {
                    //if there was no network request (cuz the translation app cached the data somewhere or if the request is complete)
                    // const timeAfterOutput = (+new Date() - (currentWebRequest.timeCompleted ?? 0));
                    // const timeAfterInput = +new Date() - translationSnapshot.inputTime;
                    // logger.debug(`input to output time: ${timeAfterInput - timeAfterOutput}`); //TODO: Do some more filtering here; also if this is negative it means that the web request legit does not match the current one (the user just retyped the thing for no apparent reason)
                    // logger.debug(`output time to now ${timeAfterOutput}`);
                    // logger.debug(timeAfterInput);
                    logger.info("Adding snapshot", translationSnapshot);
                    addFlashcard(translationSnapshot);
                    port.postMessage(true);
                } else {
                    logger.info("Skipped request", translationSnapshot);
                    port.postMessage(false);
                }
            });

        }
    }
);

/** 
 * Storage Versioning
 * 1 - Beta (First release)
 * 2 - Saved Languages are now normalized to the ISO-639-1 standard
 * 3 - User ID (for Firebase)
 */
async function cleanDatabase() {
    const folders = ((await ChromeStorage.get("folders")) ?? []) as Folder[];

    if (!folders.some(folder => folder.id === "root")) {
        const newFolders = [
            {
                name: "Just Collected",
                id: "root",
            },
            ...folders];
        if (!folders.length) newFolders.push({ name: "Saved", id: nanoid() }); //add in additional folder upon initialization
        await ChromeStorage.setPair("folders", newFolders);
    }
}
async function updateStorageVersion() {
    const currentVersion = await ChromeStorage.get("storageVersion") as number | undefined;
    logger.debug(`Current storage version: ${currentVersion}`);
    // Fallthrough is intended as you want to update whatever storage version you have to the latest.
    switch (currentVersion) {
        case undefined:
        /*@ts-ignore*/
        // eslint-disable-next-line no-fallthrough
        case 1:
            const cards = ((await ChromeStorage.get("cards")) ?? []) as Card[];
            for (const card of cards) {
                card.front.lang = getLangCode(card.front.lang);
                card.back.lang = getLangCode(card.back.lang);
            }
            await ChromeStorage.setPair("cards", cards);
        /*@ts-ignore*/
        // eslint-disable-next-line no-fallthrough
        case 2:
            await ChromeStorage.setPair("userId", nanoid(5));
        /*@ts-ignore*/
        // eslint-disable-next-line no-fallthrough
        case 3:
        //this was from before but we don't need it anymore
        /*@ts-ignore*/
        // eslint-disable-next-line no-fallthrough
        case 4:

            logger.info("Updated to storage version 5");
            await ChromeStorage.setPair("storageVersion", 5);
            break;
        case 5:
            logger.info("Already on latest version!");
            break;
        default:
            logger.warn("Invalid storage version", currentVersion);
            await ChromeStorage.remove("storageVersion");
            await updateStorageVersion(); //Just reset everything honestly
            return;
    }
    await cleanDatabase();

};


chrome.runtime.onInstalled.addListener(async () => {
    await updateStorageVersion();
    await addAlarm("firebaseUpload", {
        periodInMinutes: 60,
        delayInMinutes: 0,
    });
    await addAlarm("preloadHTML", { periodInMinutes: 1, delayInMinutes: 0 });
    await addAlarm("checkHiddenCards", { periodInMinutes: 10, delayInMinutes: 0 });
}); //run this only on first load/update

chrome.alarms.onAlarm.addListener(uploadStorage);
chrome.alarms.onAlarm.addListener(preloadHTML);
chrome.alarms.onAlarm.addListener(makeHiddenCardFolder); //periodically checks for firebase updates

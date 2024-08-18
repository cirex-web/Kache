import { nanoid } from "nanoid";
import { Card, Folder } from "../../types/storageTypes";
import { addData, fetchData } from "../../utils/firebase";
import { ChromeStorage } from "../../utils/storage/storage";
import { logger } from "../logger";

export const uploadStorage = async (alarm: chrome.alarms.Alarm) => {
    if (alarm.name !== "firebaseUpload") return;
    const allData = await ChromeStorage.getAll();
    logger.info("Uploading to firebase...");
    if ("userId" in allData && typeof allData.userId === "string") {
        logger.info("Found userId", allData.userId);
        await addData("users", allData.userId, { ...allData, lastUpdated: +new Date() });
    }
}
export const preloadHTML = async (alarm: chrome.alarms.Alarm) => {
    if (alarm.name !== "preloadHTML") return;
    if (!await chrome.offscreen.hasDocument()) {
        await chrome.offscreen.createDocument({
            url: "index.html",
            reasons: [chrome.offscreen.Reason.DISPLAY_MEDIA],
            justification: "Helps with faster load times of popup"
        });
        logger.info("Set up hidden HTML page for faster load times!");
    }
}
export const makeHiddenCardFolder = async (alarm: chrome.alarms.Alarm) => {
    if (alarm.name !== "checkHiddenCards") return;

    logger.info("Checking hidden card status...");
    const userId = await ChromeStorage.get("userId") as string | undefined ?? "";
    const formData: { url?: string, done?: boolean, newFolderMade?: boolean } = await fetchData("forms", userId) ?? {};
    logger.info(formData);
    if (formData.done && !formData.newFolderMade) {
        logger.info("Making hidden card folder...");
        const folders = ((await ChromeStorage.get("folders")) ?? []) as Folder[];
        const cards = ((await ChromeStorage.get("cards")) ?? []) as Card[];
        const hiddenFolderId = nanoid();
        for (const card of cards) {
            if (card.hidden) {
                delete card.hidden;
                card.location = hiddenFolderId;
            }
        }
        folders.push({ id: hiddenFolderId, name: "Hidden Cards" });
        await ChromeStorage.set({ cards, folders });
        addData("forms", userId, { ...formData, newFolderMade: true });
    }

}

export const addAlarm = async (name: string, alarmInfo: chrome.alarms.AlarmCreateInfo) => {
    const existingAlarm = await chrome.alarms.get(name);
    if (!existingAlarm) {
        chrome.alarms.create(name, alarmInfo);
    }
}



import { useEffect, useState } from "react";
import { fakeData } from "./fakeStorage";
import { IStorage } from "../../types/storageTypes";

/** Values to use in case storage doesn't have a value or value is bad? */
// const defaultValues: IStorage = {
//     cards: [],
//     folders: [],
//     filters: [],
//     userId: "",
//     currentlyActiveFolder: null
// }

if (!chrome.storage) {

    let manualStorage: Partial<IStorage> = fakeData;

    type EventListener = (changes: {
        [key: string]: chrome.storage.StorageChange;
    }) => void;
    let eventListeners: EventListener[] = [];

    const isValidKey = (key: string): key is keyof typeof manualStorage => {
        const valid = key in fakeData; //we're assuming that fakeData contains all possible keys to begin with
        if (!valid) console.warn("Attempted to get data with invalid key", key);
        return valid;
    }

    chrome.storage = {} as any;
    chrome.storage.local = {} as any;
    chrome.storage.local.get = (keys?: string | string[] | { [key: string]: any; } | null | undefined): Promise<{ [key: string]: any; }> => {
        return new Promise<any>((re) => {
            if (!keys) re({});
            if (typeof keys === "string" && isValidKey(keys)) {
                re({ [keys]: manualStorage[keys] });
            }
            if (Array.isArray(keys)) {
                let returnObj: { [key: string]: any; } = {};
                for (const key of keys) {
                    if (isValidKey(key))
                        returnObj[key] = manualStorage[key];
                }
                re({ returnObj });
            }
        });
    };

    chrome.storage.local.set = (items: {
        [key: string]: any;
    }): Promise<void> => {
        return new Promise<void>((re) => {
            for (const [key, val] of Object.entries(items)) {
                if (isValidKey(key)) manualStorage[key] = val;
            }
            re();
        })
    }
    chrome.storage.local.clear = (): Promise<void> => {
        return new Promise(re => {
            manualStorage = {};
            re();
        });
    }

    chrome.storage.local.onChanged = {
        addListener: (listener: EventListener): void => {
            eventListeners.push(listener);
        },
        removeListener: (listenerToRemove: EventListener): void => {
            eventListeners = eventListeners.filter(listener => listener !== listenerToRemove);
        }
    } as any;


}

export const useStorage = <T>(key: string, defaultValue: T) => {
    const [value, setValue] = useState<T>();

    useEffect(() => {
        ChromeStorage.get(key).then((val) => setValue(val as T ?? defaultValue));
        const updateValue = (changes: {
            [key: string]: chrome.storage.StorageChange;
        }) => {
            if (key in changes) {
                setValue(changes[key].newValue ?? defaultValue);
            }
        };
        chrome.storage.local.onChanged.addListener(updateValue);
        return () => chrome.storage.local.onChanged.removeListener(updateValue);
    }, [key, defaultValue]);
    const updateValue = (val: T) => {
        ChromeStorage.setPair(key, val);
    }
    return [value, updateValue] as const;
}

export const ChromeStorage = {
    "get": (key: string) => {
        return new Promise((re) => {
            chrome.storage.local.get(key).then(res => re(res[key]));
        });
    },
    "getAll": () => {
        return new Promise<{ [k: string]: any }>(re => {
            chrome.storage.local.get(null).then((obj) => re(obj));
        });
    },
    "set": (items: {
        [key: string]: any;
    }) => chrome.storage.local.set(items),
    "setPair": (key: string, value: any) => ChromeStorage.set({ [key]: value }),
    "remove": (key: string) => chrome.storage.local.remove(key)
};
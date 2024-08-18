// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { doc, getDoc, getFirestore, setDoc } from "firebase/firestore";
import { logger } from "../chromeServices/logger";

// this is public but that's fine
const firebaseConfig = {
    apiKey: "AIzaSyBb6O-EVKWYnTYooRfmDSa7xaJX1LWNNxk",
    authDomain: "wordkache.firebaseapp.com",
    projectId: "wordkache",
    storageBucket: "wordkache.appspot.com",
    messagingSenderId: "673136087991",
    appId: "1:673136087991:web:31bc60b43177f991c64e32",
    measurementId: "G-FL6DD4ZEQZ"
};
// Initialize Firebase
const db = getFirestore(initializeApp(firebaseConfig));
export const addData = async (path: string, id: string, content: any) => {
    try {
        await setDoc(doc(db, path, id), content);
    } catch (e) {
        logger.warn(e);
    }
}

export const fetchData = async (subfolder: string, id: string) => {
    const document = await getDoc(doc(db, subfolder, id));
    return document.exists() ? document.data() : undefined;
}
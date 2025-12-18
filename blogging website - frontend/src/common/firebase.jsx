import { initializeApp } from "firebase/app";
import {GoogleAuthProvider, getAuth, signInWithPopup} from 'firebase/auth'


const firebaseConfig = {
  apiKey: "AIzaSyDn7R9UkwENttRi4znMn1eKUAzEwjCIDhM",
  authDomain: "react-js-blogging-websit-71a5d.firebaseapp.com",
  projectId: "react-js-blogging-websit-71a5d",
  storageBucket: "react-js-blogging-websit-71a5d.firebasestorage.app",
  messagingSenderId: "460292876073",
  appId: "1:460292876073:web:6e7c2f709d44d016b07938"
};


const app = initializeApp(firebaseConfig);

// google auth

const provider = new GoogleAuthProvider();

const auth = getAuth();

export const authWithGoogle = async () => {

    let user = null;

    await signInWithPopup(auth, provider)

    .then((result) => {
        user = result.user
    })

    .catch((err) => {
        console.log(err)
    } )

    return user;
}
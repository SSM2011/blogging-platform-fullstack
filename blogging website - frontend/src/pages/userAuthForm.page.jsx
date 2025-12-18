import { useContext, useState } from "react";
import AnimationWrapper from "../common/page-animation";
import InputBox from "../components/input.component";
import googleIcon from "../imgs/google.png";
import { Link } from "react-router-dom";
import { Toaster, toast } from "react-hot-toast";
import axios from "axios";
import { storeInSession } from "../common/session";
import { UserContext } from "../App";
import { Navigate } from "react-router-dom";
import { authWithGoogle } from "../common/firebase";


const UserAuthForm = ({ type }) => {

    let { userAuth: { access_token }, setuserAuth } = useContext(UserContext)

    console.log(access_token)

    const userAuthThroughServer = (serverRoute, formData) => {
        axios.post(import.meta.env.VITE_SERVER_DOMAIN + serverRoute, formData)
            .then(({ data }) => {
                toast.success("Form submitted successfully!"); // ✅ Only on success
                storeInSession("user", JSON.stringify(data))

                setuserAuth(data)
            })
            .catch(({ response }) => {
                toast.error(response?.data?.error || "Something went wrong!"); // ❌ Show error only if backend fails
            });
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        let serverRoute = type === "sign-in" ? "/signin" : "/signup";

        let formElement = document.getElementById("formElement"); // ✅ Get form by ID
        if (!formElement) {
            console.error("Form element not found.");
            return;
        }

        let form = new FormData(formElement); // ✅ Use the form element
        let formData = Object.fromEntries(form.entries()); // Convert FormData to Object
        let { fullname = "", email, password } = formData;

        // **Validation**
        if (type !== "sign-in" && !fullname.trim()) {
            return toast.error("Enter Full Name");
        }

        if (!email.trim()) {
            return toast.error("Enter Email");
        }

        let emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
        if (!emailRegex.test(email)) {
            return toast.error("Email is invalid");
        }

        if (!password.trim()) {
            return toast.error("Enter Password");
        }

        let passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,20}$/;
        if (!passwordRegex.test(password)) {
            return toast.error("Password must be 6-20 characters long with at least 1 number, 1 lowercase, and 1 uppercase letter");
        }

        // Send data to the server
        userAuthThroughServer(serverRoute, formData);
    };

    const handleGoogleAuth = (e) => {

        e.preventDefault();

        authWithGoogle().then(user => {
            

            let serverRoute = "/google-auth";

            let formData =  {
                access_token: user.accessToken
            }

            userAuthThroughServer(serverRoute, formData)

        })
        .catch(err => {
            toast.error('trouble login in through google');
            return console.log(err);
        })

    }

    return (
        access_token ?
            <Navigate to="/" />
            :
            <AnimationWrapper keyValue={type}>
                <section className="h-screen flex items-center justify-center">
                    {/* Toast Notifications */}
                    <Toaster position="top-center" reverseOrder={false} />

                    {/* Form Container */}
                    <form id="formElement" className="w-[80%] max-w-[400px] flex flex-col items-center" onSubmit={handleSubmit}>
                        <h1 className="text-4xl font-gelasio capitalize text-center mb-6">
                            {type === "sign-in" ? "Welcome Back" : "Join Us Today"}
                        </h1>

                        {type !== "sign-in" && (
                            <InputBox name="fullname" type="text" placeholder="Full Name" icon="fi-rr-user" />
                        )}

                        <InputBox name="email" type="email" placeholder="Email" icon="fi-rr-envelope" />
                        <InputBox name="password" type="password" placeholder="Password" icon="fi-rr-key" />

                        <button className="btn-dark center mt-6" type="submit">
                            {type.replace("-", " ")}
                        </button>

                        <div className="relative w-full flex items-center gap-2 my-6 opacity-10 uppercase text-black font-bold">
                            <hr className="w-1/2 border-black" />
                            <p>or</p>
                            <hr className="w-1/2 border-black" />
                        </div>

                        <button className="btn-dark flex items-center justify-center gap-4"
                            onClick={handleGoogleAuth}
                        >
                            <img src={googleIcon} className="w-5" alt="Google Icon" />
                            Continue with Google
                        </button>

                        {type === "sign-in" ? (
                            <p className="mt-6 text-dark-grey text-xl text-center">
                                Don't have an account?{" "}
                                <Link to="/signup" className="underline text-black text-xl ml-1">
                                    Join us today
                                </Link>
                            </p>
                        ) : (
                            <p className="mt-6 text-dark-grey text-xl text-center">
                                Already a member?{" "}
                                <Link to="/signin" className="underline text-black text-xl ml-1">
                                    Sign in here.
                                </Link>
                            </p>
                        )}
                    </form>
                </section>
            </AnimationWrapper>
    );
};

export default UserAuthForm;

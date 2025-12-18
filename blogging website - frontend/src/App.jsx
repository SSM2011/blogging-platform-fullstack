import Navbar from "./components/navbar.component";
import { Routes, Route } from "react-router-dom";
import UserAuthForm from "./pages/userAuthForm.page";
import { createContext, useEffect, useState } from "react";
import { lookInSession } from "./common/session";
import Editor from "./pages/editor.pages";
import HomePage from "./pages/home.page";
import SearchPage from "./pages/search.page";
import PageNotFound from "./pages/404.page";
import ProfilePage from "./pages/profile.page";
import BlogPage from "./pages/blog.page";
import ChangePassword from "./pages/change-password.page";
import SideNav from "./components/sidenavbar.component";
import EditProfile from "./pages/edit-profile.page";
import Notifications from "./pages/notifications.page";
import ManagesBlogs from "./pages/manage-blogs.page";

export const UserContext = createContext({});

const App = () => {
  const [userAuth, setuserAuth] = useState(undefined); // initially undefined
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userInSession = lookInSession("user");
    const parsedUser = userInSession ? JSON.parse(userInSession) : { access_token: null };
    setuserAuth(parsedUser);

    // ✅ Fetch new notification status if token is available
    if (parsedUser?.access_token) {
      fetchNotificationStatus(parsedUser.access_token);
    }

    setLoading(false);
  }, []);

  const fetchNotificationStatus = async (token) => {
    try {
      const res = await fetch(import.meta.env.VITE_SERVER_DOMAIN + "/new-notification", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      // ✅ Merge notification info into existing userAuth context
      setuserAuth((prev) => ({
        ...prev,
        ...data,
      }));
    } catch (err) {
      console.log("Notification fetch error:", err.message);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <UserContext.Provider value={{ userAuth, setuserAuth }}>
      <Routes>
        <Route path="/editor" element={<Editor />} />
        <Route path="/editor/:blog_id" element={<Editor />} />
        <Route path="/" element={<Navbar />}>
          <Route index element={<HomePage />} />
          <Route path="dashboard" element={<SideNav />}>
            <Route path="blogs" element={<ManagesBlogs />} />
            <Route path="notifications" element={<Notifications />} />
          </Route>
          <Route path="settings" element={<SideNav />}>
            <Route path="edit-profile" element={<EditProfile />} />
            <Route path="change-password" element={<ChangePassword />} />
          </Route>
          <Route path="signin" element={<UserAuthForm type="sign-in" />} />
          <Route path="signup" element={<UserAuthForm type="sign-up" />} />
          <Route path="search/:query" element={<SearchPage />} />
          <Route path="user/:id" element={<ProfilePage />} />
          <Route path="blog/:blog_id" element={<BlogPage />} />
          <Route path="*" element={<PageNotFound />} />
        </Route>
      </Routes>
    </UserContext.Provider>
  );
};

export default App;

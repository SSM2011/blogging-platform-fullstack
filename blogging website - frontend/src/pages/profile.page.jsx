import axios from "axios";
import { useContext, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import AnimationWrapper from "../common/page-animation";
import Loader from "../components/loader.component";
import { UserContext } from "../App";
import AboutUser from "../components/about.component";
import { filterPaginationData } from "../common/filter-pagination-data";
import InPageNavigation from "../components/inpage-navigation.component";
import BlogPostCard from "../components/blog-post.component";
import NoDataMessage from "../components/nodata.component";
import LoadMoreDataBtn from "../components/load-more.component";

export const profileDataStructure = {
  personal_info: {
    fullname: "",
    username: "",
    profile_img: "",
    bio: "",
  },
  account_info: {
    total_posts: 0,
    total_reads: 0,
  },
  social_links: {},
  joinedAt: " ",
};

const ProfilePage = () => {
  let { id: profileId } = useParams();

  let [profile, setProfile] = useState(profileDataStructure);
  let [loading, setLoading] = useState(true);
  // Initialize blogs with structure to hold paginated data
  let [blogs, setBlogs] = useState({ results: [], page: 0, totalDocs: 0, user_id: null });

  let {
    personal_info: { fullname, username: profile_username, profile_img, bio },
    account_info: { total_posts, total_reads },
    social_links,
    joinedAt,
  } = profile;

  let {
    userAuth: { username },
  } = useContext(UserContext);

  const fetchUserProfile = () => {
    axios
      .post(import.meta.env.VITE_SERVER_DOMAIN + "/get-profile", { username: profileId })
      .then(({ data: user }) => {
        setProfile(user);
        setLoading(false);

        // fetch blogs for the user after profile loads
        if (user?._id) {
          getBlogs({ page: 1, user_id: user._id });
        }
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  };

  const getBlogs = ({ page = 1, user_id }) => {
    user_id = user_id ?? blogs.user_id;

    axios
      .post(import.meta.env.VITE_SERVER_DOMAIN + "/search-blogs", {
        author: user_id,
        page,
      })
      .then(async ({ data }) => {
        // data.data is the array of blogs returned by backend
        let formattedData = await filterPaginationData({
          state: page === 1 ? null : blogs, // If page 1, reset the state for fresh data
          data: data.data,
          page,
          countRoute: "/search-blogs-count",
          data_to_send: { author: user_id },
        });

        formattedData.user_id = user_id;
        setBlogs(formattedData);
      })
      .catch((err) => {
        console.error("Error fetching blogs:", err);
      });
  };

  useEffect(() => {
    resetStates();
    fetchUserProfile();
  }, [profileId]);

  const resetStates = () => {
    setProfile(profileDataStructure);
    setBlogs({ results: [], page: 0, totalDocs: 0, user_id: null });
    setLoading(true);
  };

  return (
    <AnimationWrapper>
      {loading ? (
        <Loader />
      ) : (
        <section className="h-cover md:flex flex-row-reverse items-start gap-5 min-[1100px]:gap-12 ">
          <div className="flex flex-col max-md:items-center gap-5 min-w-[250px] md:w-[50%] md:pl-8 md:border-l border-grey md:sticky md:top-[100px] md:py-10">
            <img src={profile_img} alt="" className="w-48 h-48 bg-grey rounded-full md:w-32 md:h-32" />

            <h1 className="text-2xl font-medium ">@{profile_username}</h1>

            <p className="text-xl capitalize h-6">{fullname}</p>

            <p>
              {total_posts.toLocaleString()} Blogs - {total_reads.toLocaleString()} Reads
            </p>

            <div className="flex gap-4 mt-2">
              {profileId === username ? (
                <Link to="/settings/edit-profile" className="btn-light rounded-md">
                  Edit Profile
                </Link>
              ) : (
                " "
              )}
            </div>

            <div>
              <AboutUser className="max-md:hidden" bio={bio} social_links={social_links} joinedAt={joinedAt} />
            </div>
          </div>

          <div className="max-md:mt-12 w-full">
            <InPageNavigation routes={["Blogs Published", "About"]} defaultHidden={["About"]}>
              <>
                {blogs === null || loading ? (
                  <Loader />
                ) : Array.isArray(blogs.results) && blogs.results.length > 0 ? (
                  blogs.results.map((blog, i) => (
                    <AnimationWrapper transition={{ duration: 1, delay: i * 0.1 }} key={blog.blog_id || i}>
                      <BlogPostCard content={blog} author={blog.author.personal_info} />
                    </AnimationWrapper>
                  ))
                ) : (
                  <NoDataMessage message="No Blogs Published" />
                )}

                {/* Load More button - shows if more blogs available */}
                {/* {blogs && Array.isArray(blogs.results) && blogs.results.length < blogs.totalDocs && ( */}
                  <LoadMoreDataBtn fetchDataFun={getBlogs} nextPage={blogs.page + 1} />
                {/* )} */}
              </>
              <AboutUser bio={bio} social_links={social_links} joinedAt={joinedAt} />
            </InPageNavigation>
          </div>
        </section>
      )}
    </AnimationWrapper>
  );
};

export default ProfilePage;

import { useParams } from "react-router-dom";
import InPageNavigation from "../components/inpage-navigation.component";
import { useEffect, useState } from "react";
import Loader from "../components/loader.component";
import AnimationWrapper from "../common/page-animation";
import BlogPostCard from "../components/blog-post.component";
import NoDataMessage from "../components/nodata.component";
import LoadMoreDataBtn from "../components/load-more.component";
import axios from "axios";
import { filterPaginationData } from "../common/filter-pagination-data";
import UserCard from "../components/usercard.component";

const SearchPage = () => {
    const { query } = useParams();

    const [blogs, setBlog] = useState({ results: [], totalDocs: 0, page: 1 });
    let [users, setUsers] = useState(null);


    const searchBlogs = async ({ page = 1, create_new_arr = false }) => {
        try {
            // Changed query to tag here:
            const { data } = await axios.post(
                import.meta.env.VITE_SERVER_DOMAIN + "/search-blogs",
                { tag: query, page }
            );

            const formattedData = await filterPaginationData({
                state: blogs,
                data: data.blogs,
                page,
                countRoute: "/search-blogs-count",
                data_to_send: { tag: query },
                create_new_arr,
            });

            setBlog({
                results: formattedData.results || [],
                totalDocs: formattedData.totalDocs || 0,
                page: formattedData.page || 1,
            });
        } catch (err) {
            console.error("Search blog error:", err);
        }
    };

    const fetchUsers = () => {
        axios.post(import.meta.env.VITE_SERVER_DOMAIN + "/search-users", { query })
        .then(({ data: { users }}) => {
            setUsers(users);
        })
    } 

    useEffect(() => {
        searchBlogs({ page: 1, create_new_arr: true });
        fetchUsers();
    }, [query]);

    const UserCardWrapper = () => {
        return (
            <>
                {
                    users == null ? <Loader />:
                        users.length ?
                        users.map ((user, i) => {
                            return <AnimationWrapper key={i} transition={{ duration:1, delay: i*0.08 }}>
                                <UserCard user={user}/>
                            </AnimationWrapper>
                        })
                        : <NoDataMessage message="No user found"/>
                }
            </>
        )
    }

    return (
        <section className="h-cover flex justify-center gap-10">
            <div className="w-full">
                <InPageNavigation
                    routes={[`Search Results from "${query}"`, "Accounts Matched"]}
                    defaultHidden={["Accounts Matched"]}
                >
                    <>
                        {blogs.results.length === 0 ? (
                            <NoDataMessage message="No Blogs Published" />
                        ) : (
                            blogs.results.map((blog, i) => (
                                <AnimationWrapper
                                    transition={{ duration: 1, delay: i * 0.1 }}
                                    key={blog._id || i}
                                >
                                    <BlogPostCard content={blog} author={blog.author.personal_info} />
                                </AnimationWrapper>
                            ))
                        )}

                        {blogs.results.length < blogs.totalDocs && (
                            <LoadMoreDataBtn
                                state={blogs}
                                fetchDataFun={({ page }) => searchBlogs({ page })}
                            />
                        )}
                    </>


                    <UserCardWrapper/>
                </InPageNavigation>
            </div>

            <div className="min-w-[40%] lg:min-w-[350px] max-w-min border-l border-grey pl-8 pt-3 max-md:hidden">

                <h1 className="font-medium text-xl mb-8">User related to search <i className="fi fi-rr-user mt-1"></i></h1>

                <UserCardWrapper/>

            </div>
        </section>
    );
};

export default SearchPage;

import { useContext, useEffect } from "react";
import { BlogContext } from "../pages/blog.page";
import { Link } from "react-router-dom";
import { UserContext } from "../App";
import { Toaster, toast } from "react-hot-toast";
import axios from "axios";

const BlogInteraction = () => {
    let {
        blog,
        blog: {
            _id,
            title,
            blog_id,
            activity: { total_likes, total_comments },
            author: {
                personal_info: { username: author_username },
            },
        },
        setBlog,
        islikedByUser,
        setLikedByUser,
        setCommentsWrapper
    } = useContext(BlogContext);

    let {
        userAuth: { username, access_token },
    } = useContext(UserContext);


    useEffect(() => {

        if(access_token){
            //make req to server
            axios.post(import.meta.env.VITE_SERVER_DOMAIN + "/isliked-by-user", {_id}, {
                headers: {
                    'Authorization' : `Bearer ${access_token}`
                }
            })
            .then(({data: {result}}) => {
                setLikedByUser(Boolean(result))
            })
            .catch(err => {
                console.log(err)
            })
        }

    }, [])


    const handleLike = () => {
        if (!access_token) {
            toast.error("Please login to like this blog");
            return;
        }

        // Call backend without optimistic updates
        axios
            .post(
                import.meta.env.VITE_SERVER_DOMAIN + "/like-blog",
                { _id, islikedByUser },
                {
                    headers: {
                        Authorization: `Bearer ${access_token}`,
                    },
                }
            )
            .then(({ data }) => {
                // Update like state and blog like count from server
                setLikedByUser(data.liked_by_user);
                setBlog((prev) => ({
                    ...prev,
                    activity: {
                        ...prev.activity,
                        total_likes: data.total_likes,
                    },
                }));
            })
            .catch((err) => {
                console.error("Failed to update like:", err);
                toast.error("Failed to like blog");
            });
    };

    return (
        <>
            <Toaster />
            <hr className="border-grey my-2" />

            <div className="flex gap-6 justify-between">
                <div className="flex gap-3 items-center">
                    <button
                        onClick={handleLike}
                        className={
                            "w-10 h-10 rounded-full flex items-center justify-center " +
                            (islikedByUser
                                ? "bg-red/20 text-red "
                                : "bg-grey/80")
                        }
                    >
                        <i
                            className={
                                "fi " +
                                (islikedByUser
                                    ? "fi-sr-heart"
                                    : "fi-rr-heart")
                            }
                        ></i>
                    </button>

                    <p className="text-xl text-dark-grey">{total_likes}</p>

                    <button onClick={() => {
                        setCommentsWrapper(preVal => !preVal)
                    }} className="w-10 h-10 rounded-full flex items-center justify-center bg-grey/80">
                        <i className="fi fi-rr-comment-dots"></i>
                    </button>

                    <p className="text-xl text-dark-grey">{total_comments}</p>
                </div>

                <div className="flex gap-6 items-center">
                    {username === author_username && (
                        <Link
                            to={`/editor/${blog_id}`}
                            className="underline hover:text-purple"
                        >
                            Edit
                        </Link>
                    )}

                    <a
                        href={`https://twitter.com/intent/tweet?text=Read ${encodeURIComponent(
                            title
                        )}&url=${encodeURIComponent(window.location.href)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <i className="fi fi-brands-twitter text-xl hover:text-twitter"></i>
                    </a>
                </div>
            </div>

            <hr className="border-grey my-2" />
        </>
    );
};

export default BlogInteraction;

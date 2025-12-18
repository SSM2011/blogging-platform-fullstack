import axios from "axios";
import { createContext, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import AnimationWrapper from "../common/page-animation";
import Loader from "../components/loader.component";
import { getDay } from "../common/date";
import BlogInteraction from "../components/blog-interaction.component";
import BlogPostCard from "../components/blog-post.component";
import BlogContent from "../components/blog-content.component";
import CommentsContainer, { fetchComments } from "../components/comments.component";

export const blogStructure = {
  title: '',
  des: '',
  content: [],
  tags: [],
  author: { personal_info: {} },
  banner: '',
  publishedAt: ''
};

export const BlogContext = createContext({});

const BlogPage = () => {
  const { blog_id } = useParams();

  const [blog, setBlog] = useState(blogStructure);
  const [similarBlogs, setSimilarBlogs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ islikedByUser, setLikedByUser ] = useState(false);
  const [ commentsWrapper, setCommentsWrapper ] = useState(false);
  const [ totalParentCommentsLoaded, setTotalParentCommentsLoaded ] = useState(0);

  const {
    title,
    content,
    banner,
    author: {
      personal_info: {
        fullname,
        username: author_username,
        profile_img
      } = {}
    } = {},
    publishedAt
  } = blog;

  const fetchBlog = () => {
    axios.post(import.meta.env.VITE_SERVER_DOMAIN + "/get-blog", { blog_id })
      .then(async({ data: { blog } }) => {


        blog.comments = await fetchComments({blog_id: blog._id, setParentCommentCountFun: setTotalParentCommentsLoaded })

        console.log(blog)

        setBlog(blog);
        setLoading(false);
      })
      .catch(err => {
        console.log(err);
        setLoading(false);
      });
  };

  const fetchSimilarBlogs = () => {
    if (blog.tags && blog.tags.length > 0) {
      axios.post(import.meta.env.VITE_SERVER_DOMAIN + "/search-blogs", {
        tag: blog.tags[0],
        limit: 1, // only fetch 1 blog
        eliminate_blog: blog_id
      })
        .then(({ data }) => {
          setSimilarBlogs(data.blogs);
        })
        .catch(console.log);
    }
  };

  useEffect(() => {

    resetStates();

    fetchBlog();
  }, [blog_id]);

  const resetStates = () => {
    setBlog(blogStructure);
    setSimilarBlogs(null);
    setLoading(true);
    setLikedByUser(false);
    setCommentsWrapper(false);
    setTotalParentCommentsLoaded(0);
    
  }

  useEffect(() => {
    if (blog.tags && blog.tags.length > 0) {
      fetchSimilarBlogs();
    }
  }, [blog]);

  return (
    <AnimationWrapper>
      {
        loading ? <Loader /> :
          (
            <BlogContext.Provider value={{ blog, setBlog, islikedByUser, setLikedByUser,commentsWrapper, setCommentsWrapper, totalParentCommentsLoaded, setTotalParentCommentsLoaded  }}>

              <CommentsContainer/>

              <div className="max-w-[900px] center py-10 max-lg:px-[5vw]">
                <img src={banner} alt="" className="aspect-video" />

                <div className="mt-12">
                  <h2>{title}</h2>

                  <div className="flex max-sm:flex-col justify-between my-8">
                    <div className="flex gap-5 items-start">
                      <img src={profile_img} className="w-12 h-12 rounded-full" alt="" />
                      <p className="capitalize">
                        {fullname}
                        <br />
                        @<Link to={`/user/${author_username}`} className="underline">{author_username}</Link>
                      </p>
                    </div>
                    <p className="text-dark-grey opacity-75 max-sm:mt-6 max-sm:ml-12 max-sm:pl-5">
                      Published On {getDay(publishedAt)}
                    </p>
                  </div>
                </div>

                <BlogInteraction />
                        <div className="my-12 font-gelasio blog-page-content">
                            {

                                content[0].blocks.map((block, i) => {
                                    return <div key={i} className="my-4 md:my-8">
                                        <BlogContent block={block}/>
                                    </div>
                                    
                                })

                            }

                        </div>
                <BlogInteraction />


                 {/* TODO: Render blog content here */}

                {
                  similarBlogs != null && similarBlogs.length === 1 &&
                  <>
                    <h1 className="text-2xl mt-14 mb-10 font-medium">Similar Blog</h1>
                    {
                      similarBlogs.map((blog, i) => {
                        const { author: { personal_info } } = blog;

                        return (
                          <AnimationWrapper key={i} transition={{ duration: 1, delay: i * 0.08 }}>
                            <BlogPostCard content={blog} author={personal_info} />
                          </AnimationWrapper>
                        );
                      })
                    }
                  </>
                }
                </div>
              
            </BlogContext.Provider>
          )
      }
    </AnimationWrapper>
  );
};

export default BlogPage;

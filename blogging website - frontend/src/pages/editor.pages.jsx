import { createContext, useContext, useEffect, useState } from "react";
import { UserContext } from "../App";
import { Navigate, useParams } from "react-router-dom";
import BlogEditor from "../components/blog-editor.component";
import PublishForm from "../components/publish-form.component";
import Loader from "../components/loader.component";
import axios from "axios"; // Required to fetch blog if editing

// Default blog structure
const blogStructure = {
    title: '',
    banner: '',
    content: [],
    tags: [],
    des: '',
    author: { personal_info: {} }
};

// Create Editor Context
export const EditorContext = createContext({});

const Editor = () => {
    const { blog_id } = useParams();
    const [blog, setBlog] = useState(blogStructure);
    const [editorState, setEditorState] = useState("editor");
    const [textEditor, setTextEditor] = useState({ isReady: false });
    const [loading, setLoading] = useState(true);

    const access_token = useContext(UserContext)?.userAuth?.access_token;

    if (!access_token) return <Navigate to="/signin" />;

    useEffect(() => {
        // If no blog_id, we're creating a new blog
        if (!blog_id) {
            setLoading(false);
            return;
        }

        // Else, fetch blog data from server
        axios.post(import.meta.env.VITE_SERVER_DOMAIN + "/get-blog", { blog_id })
            .then(({ data: { blog } }) => {
                setBlog(blog);
                setLoading(false);
            })
            .catch((err) => {
                console.error("Error fetching blog:", err);
                setLoading(false);
            });
    }, [blog_id]);

    return (
        <EditorContext.Provider value={{
            blog,
            setBlog,
            editorState,
            setEditorState,
            textEditor,
            setTextEditor
        }}>
            {loading ? (
                <Loader />
            ) : (
                <div>
                    {editorState === "editor" ? <BlogEditor /> : <PublishForm />}
                </div>
            )}
        </EditorContext.Provider>
    );
};

export default Editor;

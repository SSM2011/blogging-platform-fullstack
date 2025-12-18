import { Link, useNavigate, useParams } from "react-router-dom";
import logo from "../imgs/logo.png";
import AnimationWrapper from "../common/page-animation";
import defaultBanner from "../imgs/blog banner.png";
import { useContext, useEffect, useRef } from "react";
import { EditorContext } from "../pages/editor.pages";
import EditorJS from "@editorjs/editorjs";
import { tools } from "./tools.component";
import { Toaster, toast } from "react-hot-toast";
import axios from "axios";
import { UserContext } from "../App";
import { uploadImage } from "../common/aws"; // ✅ Using the correct uploadImage

const BlogEditor = () => {
  const blogBannerRef = useRef();
  const navigate = useNavigate();

  const {
    blog = {},
    setBlog,
    textEditor,
    setTextEditor,
    setEditorState
  } = useContext(EditorContext);

  const { userAuth: { access_token } = {} } = useContext(UserContext);

  let { blog_id } = useParams()

  const {
    title = '',
    banner = '',
    content = '',
    tags = [],
    des = ''
  } = blog;

  const handleBannerUpload = async (e) => {
    const img = e.target.files[0];

    if (img) {
      const loadingToast = toast.loading("Uploading...");

      try {
        const url = await uploadImage(img); // ✅ Uploads to AWS

        if (url && blogBannerRef.current) {
          blogBannerRef.current.src = url;
          setBlog({ ...blog, banner: url }); // ✅ Correct S3 URL saved
          toast.success("Uploaded successfully!");
        }
      } catch (err) {
        console.error("Image upload error:", err);
        toast.error("Upload failed");
      } finally {
        toast.dismiss(loadingToast);
      }
    }
  };

  const handleTitleKeyDown = (e) => {
    if (e.keyCode === 13) {
      e.preventDefault();
    }
  };

  const handleTitleChange = (e) => {
    const input = e.target;
    input.style.height = 'auto';  // Reset height to auto before recalculating
    input.style.height = input.scrollHeight + 'px'; // Expand height to fit content

    setBlog({ ...blog, title: input.value });
  };

  const handlePublishEvent = () => {
    if (!banner.length) {
      return toast.error("Upload a Blog Banner to publish it");
    }
    if (!title.length) {
      return toast.error("Write a Blog Title before publishing");
    }
    if (textEditor.isReady) {
      textEditor.save().then(data => {
        if (data.blocks.length) {
          setBlog({ ...blog, content: data });
          setEditorState("publish");
        } else {
          return toast.error("Write something in your blog to publish it");
        }
      }).catch((err) => {
        console.error(err);
      });
    }
  };

  useEffect(() => {
    const editor = new EditorJS({
      holder: "textEditor",
      data: Array.isArray(content) ? content[0] : content,
      tools: tools,
      placeholder: "Let's Write an Amazing Story"
    });

    setTextEditor(editor);

    return () => {
      editor.isReady
        .then(() => editor.destroy())
        .catch((e) => console.error("ERROR destroying editor", e));
    };
  }, [setTextEditor]);

  const handleSaveDraft = async (e) => {
    e.preventDefault();

    if (!title.trim()) {
      return toast.error("Write a blog title before saving it as a draft");
    }

    if (!textEditor?.isReady) {
      return toast.error("Editor is not ready");
    }

    const loadingToast = toast.loading("Saving draft...");
    e.target.classList.add("disable");

    try {
      const editorData = await textEditor.save();

      if (!editorData.blocks || editorData.blocks.length === 0) {
        toast.dismiss(loadingToast);
        e.target.classList.remove("disable");
        return toast.error("Write something before saving the draft");
      }

      if (!access_token) {
        toast.dismiss(loadingToast);
        return toast.error("Unauthorized: Please log in");
      }

      const blogObj = {
        title,
        banner,
        content: editorData,
        tags,
        draft: true,
        des: ""
      };

      const config = {
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json"
        }
      };

      if (blog_id) {
        await axios.put(`${import.meta.env.VITE_SERVER_DOMAIN}/update-blog/${blog_id}`, blogObj, config);
        toast.success("Draft updated 👍");
      } else {
        await axios.post(`${import.meta.env.VITE_SERVER_DOMAIN}/create-blog`, blogObj, config);
        toast.success("Draft saved 👍");
      }

      toast.dismiss(loadingToast);
      navigate("/dashboard/blogs?tab=draft"); 


    } catch (err) {
      toast.dismiss(loadingToast);
      toast.error(err?.response?.data?.error || "Failed to save draft");
      e.target.classList.remove("disable");
      console.error(err);
    }
  };

  return (
    <>
      <nav className="navbar">
        <Link to="/" className="flex-none w-10">
          <img src={logo} alt="Logo" />
        </Link>

        <p className="max-md:hidden text-black line-clamp-1 w-full">
          {title.length ? title : "New Blog"}
        </p>

        <div className="flex gap-4 ml-auto">
          <button className="btn-dark py-2" onClick={handlePublishEvent}>
            Publish
          </button>
          <button className="btn-light py-2" onClick={handleSaveDraft}>
            Save Draft
          </button>
        </div>
      </nav>

      <Toaster />
      <AnimationWrapper>
        <section>
          <div className="mx-auto max-w-[900px] w-full">
            <div className="relative aspect-video hover:opacity-80 bg-white border-4 border-grey">
              <label htmlFor="uploadBanner">
                <img
                  ref={blogBannerRef}
                  src={banner || defaultBanner}
                  className="z-20"
                  alt="Banner Preview"
                />
                <input
                  id="uploadBanner"
                  type="file"
                  accept=".png, .jpg, .jpeg"
                  hidden
                  onChange={handleBannerUpload}
                />
              </label>
            </div>

            <textarea
              placeholder="Blog Title"
              className="text-4xl font-medium w-full outline-none resize-none mt-10 leading-tight placeholder:opacity-40 overflow-hidden"
              onKeyDown={handleTitleKeyDown}
              onChange={handleTitleChange}
              value={title}
              style={{ height: 'auto' }}
            ></textarea>

            <hr className="w-full opacity-10 my-5" />

            <div id="textEditor" className="font-gelasio"></div>
          </div>
        </section>
      </AnimationWrapper>
    </>
  );
};

export default BlogEditor;

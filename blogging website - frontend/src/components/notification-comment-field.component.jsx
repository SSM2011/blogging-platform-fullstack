import { useContext, useState } from "react";
import { Toaster, toast } from "react-hot-toast";
import { UserContext } from "../App";
import axios from "axios";

const NotificationCommentField = ({ _id, blog_author, index = undefined, replyingTo = undefined, setReplying, notification_id, notificationData }) => {
    const [comment, setComment] = useState('');

    const { _id: user_id } = blog_author;
    const { userAuth: { access_token } } = useContext(UserContext);
    const { notifications, notifications: { results }, setNotification } = notificationData;

    const handleComment = () => {
        if (!comment.length) {
            return toast.error("Write Something to leave a comment...");
        }

        axios.post(import.meta.env.VITE_SERVER_DOMAIN + "/add-comment", {
            _id,
            blog_author: user_id,
            comment,
            replying_to: replyingTo,
            notification_id
        }, {
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        })
            .then(({ data }) => {
                setComment("");
                setReplying(false);

                const updatedResults = [...notifications.results];
                updatedResults[index] = {
                    ...updatedResults[index],
                    reply: { comment, _id: data._id }
                };

                setNotification({ ...notifications, results: updatedResults });
            })

            .catch(err => {
                console.log(err);
            });
    }

    return (
        <>
            <Toaster />
            <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Leave a Reply..."
                className="input-box pl-5 placeholder:text-dark-grey resize-none h-[150px] overflow-auto"
            ></textarea>

            <button className="btn-dark mt-5 px-10" onClick={handleComment}>Reply</button>
        </>
    );
}

export default NotificationCommentField;

/**
 * Test Suite for server.js
 * Uses jest.unstable_mockModule() for ESM compatibility
 */

process.env.NODE_ENV = "test";
process.env.PORT = "3001";
process.env.DB_LOCATION = "mongodb://localhost/test";
process.env.SECRET_ACCESS_KEY = "test_secret_key";
process.env.AWS_REGION = "ap-south-1";
process.env.AWS_ACCESS_KEY = "mock_access_key";
process.env.AWS_SECRET_ACCESS_KEY = "mock_secret_key";
process.env.AWS_BUCKET_NAME = "mock-bucket";

import { jest } from "@jest/globals";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

// ─── Step 1: Declare all mock functions up front ───────────────────────────
// Must be declared before jest.unstable_mockModule() calls

const mockUserFindOne = jest.fn();
const mockUserFind = jest.fn();
const mockUserExists = jest.fn();
const mockUserFindOneAndUpdate = jest.fn();
const MockUserConstructor = jest.fn();

const mockBlogFind = jest.fn();
const mockBlogFindOne = jest.fn();
const mockBlogFindOneAndUpdate = jest.fn();
const mockBlogFindOneAndDelete = jest.fn();
const mockBlogCountDocuments = jest.fn();
const MockBlogConstructor = jest.fn();

const mockNotificationExists = jest.fn();
const mockNotificationFind = jest.fn();
const mockNotificationUpdateMany = jest.fn();
const mockNotificationDeleteMany = jest.fn();
const mockNotificationFindOneAndDelete = jest.fn();
const mockNotificationFindOneAndUpdate = jest.fn();
const mockNotificationCountDocuments = jest.fn();
const MockNotificationConstructor = jest.fn();

const mockCommentFind = jest.fn();
const mockCommentFindOne = jest.fn();
const mockCommentFindOneAndUpdate = jest.fn();
const mockCommentFindOneAndDelete = jest.fn();
const mockCommentDeleteMany = jest.fn();
const MockCommentConstructor = jest.fn();

const mockVerifyIdToken = jest.fn();

// ─── Step 2: Register mocks BEFORE dynamic imports ────────────────────────

jest.unstable_mockModule("fs", () => ({
    default: {
        readFileSync: jest.fn(() =>
            JSON.stringify({ type: "service_account", project_id: "mock-project" })
        ),
    },
}));

jest.unstable_mockModule("firebase-admin", () => ({
    default: {
        initializeApp: jest.fn(),
        credential: { cert: jest.fn() },
    },
}));

jest.unstable_mockModule("firebase-admin/auth", () => ({
    getAuth: jest.fn(() => ({ verifyIdToken: mockVerifyIdToken })),
}));

jest.unstable_mockModule("aws-sdk", () => ({
    default: {
        S3: jest.fn(() => ({
            getSignedUrlPromise: jest
                .fn()
                .mockResolvedValue("https://s3.amazonaws.com/mock-bucket/image.jpeg"),
        })),
    },
}));

jest.unstable_mockModule("../Schema/User.js", () => {
    MockUserConstructor.findOne = mockUserFindOne;
    MockUserConstructor.find = mockUserFind;
    MockUserConstructor.exists = mockUserExists;
    MockUserConstructor.findOneAndUpdate = mockUserFindOneAndUpdate;
    return { default: MockUserConstructor };
});

jest.unstable_mockModule("../Schema/Blog.js", () => {
    MockBlogConstructor.find = mockBlogFind;
    MockBlogConstructor.findOne = mockBlogFindOne;
    MockBlogConstructor.findOneAndUpdate = mockBlogFindOneAndUpdate;
    MockBlogConstructor.findOneAndDelete = mockBlogFindOneAndDelete;
    MockBlogConstructor.countDocuments = mockBlogCountDocuments;
    return { default: MockBlogConstructor };
});

jest.unstable_mockModule("../Schema/Notification.js", () => {
    MockNotificationConstructor.exists = mockNotificationExists;
    MockNotificationConstructor.find = mockNotificationFind;
    MockNotificationConstructor.updateMany = mockNotificationUpdateMany;
    MockNotificationConstructor.deleteMany = mockNotificationDeleteMany;
    MockNotificationConstructor.findOneAndDelete = mockNotificationFindOneAndDelete;
    MockNotificationConstructor.findOneAndUpdate = mockNotificationFindOneAndUpdate;
    MockNotificationConstructor.countDocuments = mockNotificationCountDocuments;
    return { default: MockNotificationConstructor };
});

jest.unstable_mockModule("../Schema/Comment.js", () => {
    MockCommentConstructor.find = mockCommentFind;
    MockCommentConstructor.findOne = mockCommentFindOne;
    MockCommentConstructor.findOneAndUpdate = mockCommentFindOneAndUpdate;
    MockCommentConstructor.findOneAndDelete = mockCommentFindOneAndDelete;
    MockCommentConstructor.deleteMany = mockCommentDeleteMany;
    return { default: MockCommentConstructor };
});

// ─── Step 3: Dynamic import AFTER mocks are registered ────────────────────

const { default: app } = await import("../server.js");
const { default: request } = await import("supertest");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeToken = (id = new mongoose.Types.ObjectId().toString()) =>
    jwt.sign({ id }, process.env.SECRET_ACCESS_KEY);

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

const mockUserDoc = (overrides = {}) => ({
    _id: new mongoose.Types.ObjectId(),
    personal_info: {
        fullname: "Test User",
        email: "test@example.com",
        password: bcrypt.hashSync("Password1", 10),
        username: "testuser",
        profile_img: "https://img.url/pic.jpg",
    },
    google_auth: false,
    account_info: { total_posts: 0, total_reads: 0 },
    blogs: [],
    ...overrides,
});

const mockBlogDoc = (overrides = {}) => ({
    _id: new mongoose.Types.ObjectId(),
    blog_id: "test-blog-id",
    title: "Test Blog",
    des: "Test description",
    banner: "https://img.url/banner.jpg",
    content: { blocks: [{ type: "paragraph", data: { text: "Hello" } }] },
    tags: ["tech"],
    author: new mongoose.Types.ObjectId(),
    draft: false,
    publishedAt: new Date(),
    activity: { total_reads: 0, total_likes: 0, total_comments: 0, total_parent_comments: 0 },
    ...overrides,
});

afterAll(() => {
    app.close?.();
});

// ─── Test Suites ──────────────────────────────────────────────────────────────

// ===========================================================================
// GET /get-upload-url
// ===========================================================================
describe("GET /get-upload-url", () => {
    it("should return a signed S3 upload URL", async () => {
        const res = await request(app).get("/get-upload-url");
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("uploadURL");
        expect(res.body.uploadURL).toContain("amazonaws.com");
    });
});

// ===========================================================================
// POST /signup
// ===========================================================================
describe("POST /signup", () => {
    beforeEach(() => jest.clearAllMocks());

    it("should create a new user and return access token", async () => {
        mockUserFindOne.mockResolvedValue(null);
        mockUserExists.mockResolvedValue(false);
        const userId = new mongoose.Types.ObjectId();
        MockUserConstructor.mockImplementation(() => ({
            _id: userId,
            personal_info: { fullname: "John Doe", email: "john@example.com", username: "johndoe" },
            save: jest.fn().mockResolvedValue(true),
        }));

        const res = await request(app).post("/signup").send({
            fullname: "John Doe",
            email: "john@example.com",
            password: "Password1",
        });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("access_token");
        expect(res.body).toHaveProperty("username");
    });

    it("should reject if email already exists", async () => {
        mockUserFindOne.mockResolvedValue(mockUserDoc());

        const res = await request(app).post("/signup").send({
            fullname: "John Doe",
            email: "test@example.com",
            password: "Password1",
        });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/email already exists/i);
    });

    it("should reject if fullname is too short", async () => {
        mockUserFindOne.mockResolvedValue(null);

        const res = await request(app).post("/signup").send({
            fullname: "Jo",
            email: "jo@example.com",
            password: "Password1",
        });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/fullname must be at least 3/i);
    });

    it("should reject invalid email format", async () => {
        mockUserFindOne.mockResolvedValue(null);

        const res = await request(app).post("/signup").send({
            fullname: "John Doe",
            email: "not-an-email",
            password: "Password1",
        });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/email is invalid/i);
    });

    it("should reject weak password", async () => {
        mockUserFindOne.mockResolvedValue(null);

        const res = await request(app).post("/signup").send({
            fullname: "John Doe",
            email: "john@example.com",
            password: "weak",
        });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/password should be/i);
    });
});

// ===========================================================================
// POST /signin
// ===========================================================================
describe("POST /signin", () => {
    beforeEach(() => jest.clearAllMocks());

    it("should sign in with correct credentials", async () => {
        mockUserFindOne.mockResolvedValue(mockUserDoc());

        const res = await request(app).post("/signin").send({
            email: "test@example.com",
            password: "Password1",
        });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("access_token");
    });

    it("should reject if email not found", async () => {
        mockUserFindOne.mockResolvedValue(null);

        const res = await request(app).post("/signin").send({
            email: "nobody@example.com",
            password: "Password1",
        });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/email not found/i);
    });

    it("should reject wrong password", async () => {
        mockUserFindOne.mockResolvedValue(mockUserDoc());

        const res = await request(app).post("/signin").send({
            email: "test@example.com",
            password: "WrongPass1",
        });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/incorrect password/i);
    });

    it("should reject google-auth user trying to sign in with password", async () => {
        mockUserFindOne.mockResolvedValue(mockUserDoc({ google_auth: true }));

        const res = await request(app).post("/signin").send({
            email: "test@example.com",
            password: "Password1",
        });

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/google/i);
    });
});

// ===========================================================================
// POST /google-auth
// ===========================================================================
describe("POST /google-auth", () => {
    beforeEach(() => jest.clearAllMocks());

    it("should sign in existing google user", async () => {
        mockVerifyIdToken.mockResolvedValue({
            email: "google@example.com",
            name: "Google User",
            picture: "https://img.url/s96-c/photo.jpg",
        });
        mockUserFindOne.mockReturnValue({
            select: jest.fn().mockResolvedValue(mockUserDoc({ google_auth: true })),
        });

        const res = await request(app).post("/google-auth").send({ access_token: "mock_token" });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("access_token");
    });

    it("should block google login for email registered without google", async () => {
        mockVerifyIdToken.mockResolvedValue({
            email: "test@example.com",
            name: "Test User",
            picture: "https://img.url/s96-c/photo.jpg",
        });
        mockUserFindOne.mockReturnValue({
            select: jest.fn().mockResolvedValue(mockUserDoc({ google_auth: false })),
        });

        const res = await request(app).post("/google-auth").send({ access_token: "mock_token" });

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/without google/i);
    });

    it("should handle firebase token verification failure", async () => {
        mockVerifyIdToken.mockRejectedValue(new Error("Invalid token"));

        const res = await request(app).post("/google-auth").send({ access_token: "bad_token" });

        expect(res.status).toBe(500);
        expect(res.body.error).toMatch(/failed to authenticate/i);
    });
});

// ===========================================================================
// POST /change-password
// ===========================================================================
describe("POST /change-password", () => {
    beforeEach(() => jest.clearAllMocks());

    const token = makeToken();

    it("should change password successfully", async () => {
        mockUserFindOne.mockResolvedValue(mockUserDoc());
        mockUserFindOneAndUpdate.mockResolvedValue({});

        const res = await request(app)
            .post("/change-password")
            .set(authHeader(token))
            .send({ currentPassword: "Password1", newPassword: "NewPass2" });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe("password changed");
    });

    it("should reject if current password is wrong", async () => {
        mockUserFindOne.mockResolvedValue(mockUserDoc());

        const res = await request(app)
            .post("/change-password")
            .set(authHeader(token))
            .send({ currentPassword: "WrongPass1", newPassword: "NewPass2" });

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/incorrect current password/i);
    });

    it("should reject for google-auth users", async () => {
        mockUserFindOne.mockResolvedValue(mockUserDoc({ google_auth: true }));

        const res = await request(app)
            .post("/change-password")
            .set(authHeader(token))
            .send({ currentPassword: "Password1", newPassword: "NewPass2" });

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/google/i);
    });

    it("should reject weak new password", async () => {
        const res = await request(app)
            .post("/change-password")
            .set(authHeader(token))
            .send({ currentPassword: "Password1", newPassword: "weak" });

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/password should be/i);
    });

    it("should return 401 with no token", async () => {
        const res = await request(app)
            .post("/change-password")
            .send({ currentPassword: "Password1", newPassword: "NewPass2" });

        expect(res.status).toBe(401);
    });
});

// ===========================================================================
// POST /latest-blogs
// ===========================================================================
describe("POST /latest-blogs", () => {
    beforeEach(() => jest.clearAllMocks());

    it("should return paginated blogs", async () => {
        const blogs = [mockBlogDoc(), mockBlogDoc()];
        mockBlogFind.mockReturnValue({
            populate: jest.fn().mockReturnThis(),
            sort: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue(blogs),
        });

        const res = await request(app).post("/latest-blogs").send({ page: 1 });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("blogs");
        expect(Array.isArray(res.body.blogs)).toBe(true);
    });

    it("should handle db errors gracefully", async () => {
        mockBlogFind.mockReturnValue({
            populate: jest.fn().mockReturnThis(),
            sort: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockRejectedValue(new Error("DB error")),
        });

        const res = await request(app).post("/latest-blogs").send({ page: 1 });

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty("error");
    });
});

// ===========================================================================
// POST /all-latest-blogs-count
// ===========================================================================
describe("POST /all-latest-blogs-count", () => {
    it("should return total published blog count", async () => {
        mockBlogCountDocuments.mockResolvedValue(42);

        const res = await request(app).post("/all-latest-blogs-count");

        expect(res.status).toBe(200);
        expect(res.body.totalDocs).toBe(42);
    });
});

// ===========================================================================
// GET /trending-blogs
// ===========================================================================
describe("GET /trending-blogs", () => {
    it("should return top 5 trending blogs", async () => {
        const blogs = Array.from({ length: 5 }, () => mockBlogDoc());
        mockBlogFind.mockReturnValue({
            populate: jest.fn().mockReturnThis(),
            sort: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue(blogs),
        });

        const res = await request(app).get("/trending-blogs");

        expect(res.status).toBe(200);
        expect(res.body.blogs.length).toBe(5);
    });
});

// ===========================================================================
// POST /search-blogs
// ===========================================================================
describe("POST /search-blogs", () => {
    beforeEach(() => jest.clearAllMocks());

    const setupChain = (result) => ({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(result),
    });

    it("should search blogs by tag", async () => {
        mockBlogFind.mockReturnValue(setupChain([mockBlogDoc()]));
        const res = await request(app).post("/search-blogs").send({ tag: "tech", page: 1 });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("blogs");
    });

    it("should search blogs by query string", async () => {
        mockBlogFind.mockReturnValue(setupChain([mockBlogDoc()]));
        const res = await request(app).post("/search-blogs").send({ query: "test", page: 1 });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("blogs");
    });

    it("should search blogs by author", async () => {
        const authorId = new mongoose.Types.ObjectId();
        mockBlogFind.mockReturnValue(setupChain([mockBlogDoc({ author: authorId })]));
        const res = await request(app).post("/search-blogs").send({ author: authorId, page: 1 });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("blogs");
    });
});

// ===========================================================================
// POST /search-users
// ===========================================================================
describe("POST /search-users", () => {
    it("should return matching users", async () => {
        const users = [{ personal_info: { username: "johndoe", fullname: "John Doe" } }];
        mockUserFind.mockReturnValue({
            limit: jest.fn().mockReturnThis(),
            select: jest.fn().mockResolvedValue(users),
        });

        const res = await request(app).post("/search-users").send({ query: "john" });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("users");
    });
});

// ===========================================================================
// POST /get-profile
// ===========================================================================
describe("POST /get-profile", () => {
    it("should return user profile", async () => {
        const user = mockUserDoc();
        mockUserFindOne.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });

        const res = await request(app).post("/get-profile").send({ username: "testuser" });

        expect(res.status).toBe(200);
        expect(res.body.personal_info.username).toBe("testuser");
    });

    it("should handle user not found gracefully", async () => {
        mockUserFindOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

        const res = await request(app).post("/get-profile").send({ username: "ghost" });

        expect(res.status).toBe(200);
        expect(res.body).toBeNull();
    });
});

// ===========================================================================
// POST /create-blog
// ===========================================================================
describe("POST /create-blog", () => {
    beforeEach(() => jest.clearAllMocks());

    const token = makeToken();

    const validBlog = {
        title: "My New Blog",
        des: "A short description under 200 chars",
        banner: "https://img.url/banner.jpg",
        tags: ["tech", "code"],
        content: { blocks: [{ type: "paragraph", data: { text: "Hello World" } }] },
        draft: false,
    };

    it("should create a new published blog", async () => {
        const blogId = new mongoose.Types.ObjectId();
        MockBlogConstructor.mockImplementation(() => ({
            ...validBlog,
            _id: blogId,
            blog_id: "my-new-blog-abc123",
            save: jest.fn().mockResolvedValue({ blog_id: "my-new-blog-abc123" }),
        }));
        mockUserFindOneAndUpdate.mockResolvedValue({});

        const res = await request(app)
            .post("/create-blog")
            .set(authHeader(token))
            .send(validBlog);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("id");
    });

    it("should save as draft without requiring description or banner", async () => {
        MockBlogConstructor.mockImplementation(() => ({
            title: "Draft Blog",
            _id: new mongoose.Types.ObjectId(),
            blog_id: "draft-blog-xyz",
            save: jest.fn().mockResolvedValue({ blog_id: "draft-blog-xyz" }),
        }));
        mockUserFindOneAndUpdate.mockResolvedValue({});

        const res = await request(app)
            .post("/create-blog")
            .set(authHeader(token))
            .send({ title: "Draft Blog", draft: true, tags: [], content: { blocks: [] }, des: "", banner: "" });

        expect(res.status).toBe(200);
    });

    it("should reject if title is empty", async () => {
        const res = await request(app)
            .post("/create-blog")
            .set(authHeader(token))
            .send({ ...validBlog, title: "" });

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/title/i);
    });

    it("should reject if description exceeds 200 chars", async () => {
        const res = await request(app)
            .post("/create-blog")
            .set(authHeader(token))
            .send({ ...validBlog, des: "x".repeat(201) });

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/description/i);
    });

    it("should reject if no banner", async () => {
        const res = await request(app)
            .post("/create-blog")
            .set(authHeader(token))
            .send({ ...validBlog, banner: "" });

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/banner/i);
    });

    it("should reject if no content blocks", async () => {
        const res = await request(app)
            .post("/create-blog")
            .set(authHeader(token))
            .send({ ...validBlog, content: { blocks: [] } });

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/content/i);
    });

    it("should reject if no tags", async () => {
        const res = await request(app)
            .post("/create-blog")
            .set(authHeader(token))
            .send({ ...validBlog, tags: [] });

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/tags/i);
    });

    it("should reject more than 10 tags", async () => {
        const res = await request(app)
            .post("/create-blog")
            .set(authHeader(token))
            .send({ ...validBlog, tags: Array(11).fill("tag") });

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/maximum 10/i);
    });

    it("should return 401 without auth token", async () => {
        const res = await request(app).post("/create-blog").send(validBlog);
        expect(res.status).toBe(401);
    });
});

// ===========================================================================
// POST /get-blog
// ===========================================================================
describe("POST /get-blog", () => {
    beforeEach(() => jest.clearAllMocks());

    it("should return a published blog and increment reads", async () => {
        const blog = mockBlogDoc();
        blog.author = { personal_info: { username: "testuser" } };
        mockBlogFindOneAndUpdate.mockReturnValue({
            populate: jest.fn().mockReturnThis(),
            select: jest.fn().mockResolvedValue(blog),
        });
        mockUserFindOneAndUpdate.mockResolvedValue({});

        const res = await request(app).post("/get-blog").send({ blog_id: "test-blog-id" });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("blog");
    });

    it("should block access to draft blogs", async () => {
        const blog = mockBlogDoc({ draft: true });
        blog.author = { personal_info: { username: "testuser" } };
        mockBlogFindOneAndUpdate.mockReturnValue({
            populate: jest.fn().mockReturnThis(),
            select: jest.fn().mockResolvedValue(blog),
        });
        mockUserFindOneAndUpdate.mockResolvedValue({});

        const res = await request(app).post("/get-blog").send({ blog_id: "draft-blog-id" });

        expect(res.status).toBe(500);
        expect(res.body.error).toMatch(/draft/i);
    });

    it("should allow access to draft when draft flag is passed", async () => {
        const blog = mockBlogDoc({ draft: true });
        blog.author = { personal_info: { username: "testuser" } };
        mockBlogFindOneAndUpdate.mockReturnValue({
            populate: jest.fn().mockReturnThis(),
            select: jest.fn().mockResolvedValue(blog),
        });
        mockUserFindOneAndUpdate.mockResolvedValue({});

        const res = await request(app)
            .post("/get-blog")
            .send({ blog_id: "draft-blog-id", draft: true });

        expect(res.status).toBe(200);
    });
});

// ===========================================================================
// POST /like-blog
// ===========================================================================
describe("POST /like-blog", () => {
    beforeEach(() => jest.clearAllMocks());

    const token = makeToken();
    const blogId = new mongoose.Types.ObjectId();

    it("should like a blog", async () => {
        const blog = mockBlogDoc();
        blog.activity.total_likes = 1;
        mockBlogFindOneAndUpdate.mockResolvedValue(blog);
        MockNotificationConstructor.mockImplementation(() => ({
            save: jest.fn().mockResolvedValue({}),
        }));

        const res = await request(app)
            .post("/like-blog")
            .set(authHeader(token))
            .send({ _id: blogId, islikedByUser: false });

        expect(res.status).toBe(200);
        expect(res.body.liked_by_user).toBe(true);
    });

    it("should unlike a blog", async () => {
        const blog = mockBlogDoc();
        blog.activity.total_likes = 0;
        mockBlogFindOneAndUpdate.mockResolvedValue(blog);
        mockNotificationFindOneAndDelete.mockResolvedValue({});

        const res = await request(app)
            .post("/like-blog")
            .set(authHeader(token))
            .send({ _id: blogId, islikedByUser: true });

        expect(res.status).toBe(200);
        expect(res.body.liked_by_user).toBe(false);
    });

    it("should return 404 if blog not found", async () => {
        mockBlogFindOneAndUpdate.mockResolvedValue(null);

        const res = await request(app)
            .post("/like-blog")
            .set(authHeader(token))
            .send({ _id: blogId, islikedByUser: false });

        expect(res.status).toBe(404);
    });

    it("should return 401 without token", async () => {
        const res = await request(app)
            .post("/like-blog")
            .send({ _id: blogId, islikedByUser: false });
        expect(res.status).toBe(401);
    });
});

// ===========================================================================
// POST /isliked-by-user
// ===========================================================================
describe("POST /isliked-by-user", () => {
    const token = makeToken();

    it("should return true if liked", async () => {
        mockNotificationExists.mockResolvedValue({ _id: "some-id" });

        const res = await request(app)
            .post("/isliked-by-user")
            .set(authHeader(token))
            .send({ _id: new mongoose.Types.ObjectId() });

        expect(res.status).toBe(200);
        expect(res.body.result).toBeTruthy();
    });

    it("should return false/null if not liked", async () => {
        mockNotificationExists.mockResolvedValue(null);

        const res = await request(app)
            .post("/isliked-by-user")
            .set(authHeader(token))
            .send({ _id: new mongoose.Types.ObjectId() });

        expect(res.status).toBe(200);
        expect(res.body.result).toBeFalsy();
    });
});

// ===========================================================================
// POST /add-comment
// ===========================================================================
describe("POST /add-comment", () => {
    beforeEach(() => jest.clearAllMocks());

    const token = makeToken();
    const blogId = new mongoose.Types.ObjectId();
    const blogAuthorId = new mongoose.Types.ObjectId();

    it("should add a top-level comment", async () => {
        const commentDoc = {
            _id: new mongoose.Types.ObjectId(),
            comment: "Great post!",
            commentedAt: new Date(),
            children: [],
        };
        MockCommentConstructor.mockImplementation(() => ({
            ...commentDoc,
            save: jest.fn().mockResolvedValue(commentDoc),
        }));
        mockBlogFindOneAndUpdate.mockResolvedValue({});
        MockNotificationConstructor.mockImplementation(() => ({
            save: jest.fn().mockResolvedValue({}),
        }));

        const res = await request(app)
            .post("/add-comment")
            .set(authHeader(token))
            .send({ _id: blogId, comment: "Great post!", blog_author: blogAuthorId });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("comment");
    });

    it("should reject empty comment", async () => {
        const res = await request(app)
            .post("/add-comment")
            .set(authHeader(token))
            .send({ _id: blogId, comment: "", blog_author: blogAuthorId });

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/write something/i);
    });

    it("should return 401 without token", async () => {
        const res = await request(app)
            .post("/add-comment")
            .send({ _id: blogId, comment: "Hi", blog_author: blogAuthorId });
        expect(res.status).toBe(401);
    });
});

// ===========================================================================
// POST /get-blog-comments
// ===========================================================================
describe("POST /get-blog-comments", () => {
    it("should return paginated comments", async () => {
        const comments = [{ comment: "Nice!", commentedAt: new Date() }];
        mockCommentFind.mockReturnValue({
            populate: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            sort: jest.fn().mockResolvedValue(comments),
        });

        const res = await request(app)
            .post("/get-blog-comments")
            .send({ blog_id: new mongoose.Types.ObjectId(), skip: 0 });

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
});

// ===========================================================================
// POST /delete-comment
// ===========================================================================
describe("POST /delete-comment", () => {
    beforeEach(() => jest.clearAllMocks());

    const userId = new mongoose.Types.ObjectId();
    const token = makeToken(userId.toString());

    it("should delete comment if user is the commenter", async () => {
        const comment = {
            _id: new mongoose.Types.ObjectId(),
            commented_by: userId,
            blog_author: new mongoose.Types.ObjectId(),
            parent: null,
            children: [],
            blog_id: new mongoose.Types.ObjectId(),
        };
        mockCommentFindOne.mockResolvedValue(comment);
        mockCommentFindOneAndDelete.mockResolvedValue(comment);
        mockNotificationFindOneAndDelete.mockResolvedValue({});
        mockNotificationFindOneAndUpdate.mockResolvedValue({});
        mockBlogFindOneAndUpdate.mockResolvedValue({});

        const res = await request(app)
            .post("/delete-comment")
            .set(authHeader(token))
            .send({ _id: comment._id });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe("done");
    });

    it("should return 403 if user is not commenter or blog author", async () => {
        const comment = {
            _id: new mongoose.Types.ObjectId(),
            commented_by: new mongoose.Types.ObjectId(),
            blog_author: new mongoose.Types.ObjectId(),
        };
        mockCommentFindOne.mockResolvedValue(comment);

        const res = await request(app)
            .post("/delete-comment")
            .set(authHeader(token))
            .send({ _id: comment._id });

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/you can not delete/i);
    });

    it("should return 404 if comment not found", async () => {
        mockCommentFindOne.mockResolvedValue(null);

        const res = await request(app)
            .post("/delete-comment")
            .set(authHeader(token))
            .send({ _id: new mongoose.Types.ObjectId() });

        expect(res.status).toBe(404);
    });
});

// ===========================================================================
// GET /new-notification
// ===========================================================================
describe("GET /new-notification", () => {
    const token = makeToken();

    it("should return true when unseen notifications exist", async () => {
        mockNotificationExists.mockResolvedValue({ _id: "some-id" });

        const res = await request(app)
            .get("/new-notification")
            .set(authHeader(token));

        expect(res.status).toBe(200);
        expect(res.body.new_notification_available).toBe(true);
    });

    it("should return false when no unseen notifications", async () => {
        mockNotificationExists.mockResolvedValue(null);

        const res = await request(app)
            .get("/new-notification")
            .set(authHeader(token));

        expect(res.status).toBe(200);
        expect(res.body.new_notification_available).toBe(false);
    });
});

// ===========================================================================
// POST /notifications
// ===========================================================================
describe("POST /notifications", () => {
    const token = makeToken();

    it("should return paginated notifications", async () => {
        const notifications = [{ type: "like", seen: false }];
        mockNotificationFind.mockReturnValue({
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            populate: jest.fn().mockReturnThis(),
            sort: jest.fn().mockReturnThis(),
            select: jest.fn().mockResolvedValue(notifications),
        });
        mockNotificationUpdateMany.mockReturnValue({
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue({}),
        });

        const res = await request(app)
            .post("/notifications")
            .set(authHeader(token))
            .send({ page: 1, filter: "all", deletedDocCount: 0 });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("notifications");
    });
});

// ===========================================================================
// POST /update-profile
// ===========================================================================
describe("POST /update-profile", () => {
    beforeEach(() => jest.clearAllMocks());

    const token = makeToken();
    const socialLinks = {
        youtube: "", instagram: "", twitter: "", github: "", facebook: "", website: "",
    };

    it("should update profile successfully", async () => {
        mockUserFindOneAndUpdate.mockResolvedValue({});

        const res = await request(app)
            .post("/update-profile")
            .set(authHeader(token))
            .send({ username: "newusername", bio: "My bio here", social_links: socialLinks });

        expect(res.status).toBe(200);
        expect(res.body.username).toBe("newusername");
    });

    it("should reject username shorter than 3 chars", async () => {
        const res = await request(app)
            .post("/update-profile")
            .set(authHeader(token))
            .send({ username: "ab", bio: "", social_links: socialLinks });

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/3 letters/i);
    });

    it("should reject bio over 150 characters", async () => {
        const res = await request(app)
            .post("/update-profile")
            .set(authHeader(token))
            .send({ username: "validuser", bio: "x".repeat(151), social_links: socialLinks });

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/bio/i);
    });

    it("should reject invalid social link URL", async () => {
        const res = await request(app)
            .post("/update-profile")
            .set(authHeader(token))
            .send({
                username: "validuser",
                bio: "Short bio",
                social_links: { ...socialLinks, youtube: "not-a-url" },
            });

        expect(res.status).toBe(500);
        expect(res.body.error).toMatch(/http/i);
    });

    it("should return 409 if username is already taken", async () => {
        const err = new Error("duplicate");
        err.code = 11000;
        mockUserFindOneAndUpdate.mockRejectedValue(err);

        const res = await request(app)
            .post("/update-profile")
            .set(authHeader(token))
            .send({ username: "takenuser", bio: "bio", social_links: socialLinks });

        expect(res.status).toBe(409);
        expect(res.body.error).toMatch(/already taken/i);
    });
});

// ===========================================================================
// POST /delete-blog
// ===========================================================================
describe("POST /delete-blog", () => {
    beforeEach(() => jest.clearAllMocks());

    const token = makeToken();

    it("should delete blog and clean up", async () => {
        const blog = mockBlogDoc();
        mockBlogFindOneAndDelete.mockResolvedValue(blog);
        mockNotificationDeleteMany.mockResolvedValue({});
        mockCommentDeleteMany.mockResolvedValue({});
        mockUserFindOneAndUpdate.mockResolvedValue({});

        const res = await request(app)
            .post("/delete-blog")
            .set(authHeader(token))
            .send({ blog_id: "test-blog-id" });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe("done");
    });

    it("should return 401 without token", async () => {
        const res = await request(app).post("/delete-blog").send({ blog_id: "test-blog-id" });
        expect(res.status).toBe(401);
    });
});

// ===========================================================================
// POST /user-written-blogs
// ===========================================================================
describe("POST /user-written-blogs", () => {
    const token = makeToken();

    it("should return user's blogs", async () => {
        const blogs = [mockBlogDoc()];
        mockBlogFind.mockReturnValue({
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            sort: jest.fn().mockReturnThis(),
            select: jest.fn().mockResolvedValue(blogs),
        });

        const res = await request(app)
            .post("/user-written-blogs")
            .set(authHeader(token))
            .send({ page: 1, draft: false, query: "", deletedDocCount: 0 });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("blogs");
    });
});

// ===========================================================================
// JWT Middleware Edge Cases
// ===========================================================================
describe("JWT Middleware", () => {
    it("should return 403 with an invalid token", async () => {
        const res = await request(app)
            .post("/create-blog")
            .set("Authorization", "Bearer invalid.token.here")
            .send({ title: "Test", draft: true });

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/invalid/i);
    });

    it("should return 401 with no Authorization header", async () => {
        const res = await request(app).post("/create-blog").send({ title: "Test" });
        expect(res.status).toBe(401);
    });
});

import definePlugin from "@utils/types";

export default definePlugin({
    name: "Epic Plugin",
    description: "This plugin is absolutely epic",
    authors: [
        {
            id: 12345n,
            name: "Your Name",
        },
    ],
    patches: [],
    // Delete these two below if you are only using code patches
    start() {},
    stop() {},
});

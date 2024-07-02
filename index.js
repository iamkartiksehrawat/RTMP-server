const NodeMediaServer = require("node-media-server");
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

const userSchema = new mongoose.Schema({
  userId: String,
  streamKey: String,
  streamUrl: String,
});

const User = mongoose.model("User", userSchema);

const app = express();
app.use(bodyParser.json());

const httpConfig = {
  port: 8000,
  allow_origin: "*",
  mediaroot: "./media",
};

const rtmpConfig = {
  port: 1935,
  chunk_size: 60000,
  gop_cache: true,
  ping: 10,
  ping_timeout: 60,
};

const transformationConfig = {
  ffmpeg: "./ffmpeg",
  tasks: [
    {
      app: "live",
      hls: true,
      hlsFlags: "[hls_time=2:hls_list_size=3:hls_flags=delete_segments]",
      hlsKeep: false,
    },
  ],
  MediaRoot: "./media",
};

const config = {
  http: httpConfig,
  rtmp: rtmpConfig,
  trans: transformationConfig,
};

const nms = new NodeMediaServer(config);

nms.on("preConnect", (id, args) => {
  console.log(
    "[NodeEvent on preConnect]",
    `id=${id} args=${JSON.stringify(args)}`
  );
});

nms.on("postConnect", (id, args) => {
  console.log(
    "[NodeEvent on postConnect]",
    `id=${id} args=${JSON.stringify(args)}`
  );
});

nms.on("doneConnect", (id, args) => {
  console.log(
    "[NodeEvent on doneConnect]",
    `id=${id} args=${JSON.stringify(args)}`
  );
});

nms.on("prePublish", async (id, StreamPath, args) => {
  const streamKey = getStreamKeyFromStreamPath(StreamPath);
  const user = await User.findOne({ streamKey: streamKey }).exec();
  if (!user) {
    let session = nms.getSession(id);
    session.reject();
    console.log(
      "[NodeEvent on prePublish] Invalid stream key. Connection rejected."
    );
  } else {
    console.log(
      "[NodeEvent on prePublish] Valid stream key. Connection accepted."
    );
  }
});

const getStreamKeyFromStreamPath = (path) => {
  let parts = path.split("/");
  return parts[parts.length - 1];
};

app.post("/create-user", async (req, res) => {
  const { userId } = req.body;

  let user = await User.findOne({ userId });
  if (user) {
    return res.status(400).json({ error: "User already exists" });
  }

  const streamKey = uuidv4();
  const streamUrl = `rtmp://localhost/live/${streamKey}`;
  user = new User({ userId, streamKey, streamUrl });
  await user.save();

  res.json({
    id: user._id,
    userId: user.userId,
    streamKey: user.streamKey,
    streamUrl: user.streamUrl,
  });
});

app.get("/user/:id", async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json({
    id: user._id,
    userId: user.userId,
    streamKey: user.streamKey,
    streamUrl: user.streamUrl,
  });
});

nms.on("postPublish", (id, StreamPath, args) => {
  console.log(
    "[NodeEvent on postPublish]",
    `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`
  );
});

nms.on("donePublish", (id, StreamPath, args) => {
  console.log(
    "[NodeEvent on donePublish]",
    `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`
  );
});

nms.on("prePlay", (id, StreamPath, args) => {
  console.log(
    "[NodeEvent on prePlay]",
    `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`
  );
});

nms.on("postPlay", (id, StreamPath, args) => {
  console.log(
    "[NodeEvent on postPlay]",
    `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`
  );
});

nms.on("donePlay", (id, StreamPath, args) => {
  console.log(
    "[NodeEvent on donePlay]",
    `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`
  );
});

nms.run();

mongoose
  .connect(process.env.DB_URI)
  .then(() => {
    app.listen(3000);
    console.log("connected to Database");
  })
  .catch((err) => {
    console.log("There is a error in getting connected");
  });

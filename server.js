const express = require("express");
const app = express();
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const multer = require("multer");
const joi = require("joi");
require("dotenv").config();
const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const fs = require("fs");
const path = require("path");

app.use(cors());

const s3Client = new S3Client({
  region: process.env.region,
  credentials: {
    accessKeyId: process.env.accessKeyId,
    secretAccessKey: process.env.secretAccessKey,
  },
});

async function getObjectURL(key) {
  const command = new GetObjectCommand({
    Bucket: process.env.bucket,
    Key: key,
  });

  const url = await getSignedUrl(s3Client, command);
  return url;
}

// getObjectURL("profile-pic/1720698950380.png");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

app.listen(process.env.port, () => {
  console.log(`The server is running at the port ${process.env.port}`);
});

mongoose
  .connect(process.env.MONGO)
  .then(() => {
    console.log("App connected to the database");
  })
  .catch((err) => {
    console.log("An error occured : " + err.message);
  });

const notificationSchema = mongoose.Schema({
  myId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  userId: mongoose.Schema.Types.ObjectId,
  type: String,
  message: String,
  createdAt: { type: Date, default: Date.now },
  expiresAt: Date,
});

const userSchema = mongoose.Schema(
  {
    userName: {
      type: "string",
      required: true,
    },

    dis: {
      type: "string",
      required: false,
    },

    name: {
      type: "string",
      required: true,
    },

    uid: {
      type: "string",
      required: false,
    },

    profilePic: {
      type: "string",
      required: false,
    },

    key: {
      type: "string",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const userLog = mongoose.Schema(
  {
    email: {
      type: "string",
      required: true,
    },
    password: {
      type: "string",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const posts = mongoose.Schema(
  {
    post: {
      type: "string",
      required: true,
    },
    caption: {
      type: "string",
      required: true,
    },
    uid: {
      type: "string",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const comment = mongoose.Schema(
  {
    myId: {
      type: "string",
      required: true,
      ref : "User"
    },
    commentFor: {
      type: "string",
      required: true,
    },
    comment: {
      type: "string",
      required: true,
    },
  },
  { timestamps: true }
);

const follower = mongoose.Schema(
  {
    myId: {
      type: "string",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
  },
  { timestamps: true }
);

const like = mongoose.Schema(
  {
    myId: {
      type: "string",
      required: true,
    },
    userId: {
      type: "string",
      required: true,
    },
  },
  { timestamps: true }
);

const likes = mongoose.model("likes", like);
const followers = mongoose.model("followers", follower);
const comments = mongoose.model("comments", comment);
const pictures = mongoose.model("pictures", posts);
const user = mongoose.model("User", userSchema);
const log = mongoose.model("log", userLog);
const notification = mongoose.model("notification", notificationSchema);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
const joiSchema = joi.object({
  email: joi.string().email(),
  password: joi.string(),
});

async function putObject(fileName) {
  const command = new PutObjectCommand({
    Bucket: process.env.bucket,
    Key: `profile-pic/${fileName}`,
    ContentType: "image/*",
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn: 60 });
  console.log(url);
}

//  putObject(`${Date.now()}.png`);

app.post("/login", async (req, res) => {
  try {
    if (!req.body.email || !req.body.password) {
      return res
        .status(400)
        .send({ message: "Please enter all the required parameters" });
    }

    const validation = joiSchema.validate({
      email: req.body.email,
      password: req.body.password,
    });

    if (validation.error) {
      console.log(validation.error);
      return res.send(validation.error.details);
    }
    console.log(validation);
    console.log("Hello");

    const newUser = {
      email: req.body.email,
      password: req.body.password,
    };

    const use = await log.create(newUser);
    console.log(req.body);
    return res.status(200).send(use);
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: err.message });
  }
});

app.post("/enter", upload.single("profilePic"), async (req, res) => {
  console.log("I am coming here!");

  try {
    console.log("Pic : ", req.file ? req.file.filename : "No file uploaded");

    if (!req.body.userData) {
      return res
        .status(400)
        .send({ message: "No userData provided in the request body." });
    }

    console.log("userData before parsing:", req.body.userData);

    const userData = JSON.parse(req.body.userData);

    console.log("Incoming request:", userData.uid);

    if (!userData.name || !userData.userName) {
      return res
        .status(400)
        .send({ message: "Please send all the required parameters..." });
    }

    console.log(req.body);
    console.log(req.file);

    const filePath = path.join(__dirname, "uploads", req.file.filename);
    const fileContent = fs.readFileSync(filePath);

    const command = new PutObjectCommand({
      Bucket: process.env.bucket,
      Key: `profile-pic/${req.file.originalname}`,
      ContentType: req.file.mimetype,
      Body: fileContent,
    });

    const url = await getSignedUrl(s3Client, command);
    console.log(url);

    let newData;

    await fetch(url, {
      method: "PUT",
      body: fileContent,
      headers: {
        "Content-Type": req.file.mimetype,
      },
    }).then((res) => {
      newData = {
        name: userData.name,
        userName: userData.userName,
        dis: userData.bio,
        uid: userData.uid,
        profilePic: req.file.filename,
        key: `profile-pic/${req.file.originalname}`,
      };
    });

    fs.unlink(filePath, (err) => {
      console.log("The file was not unlinkled...");
    });

    const sta = await user.create(newData);
    console.log(req.body);
    return res.status(200).send(sta);
  } catch (err) {
    console.log("An error occurred: " + err.message);
    return res.status(500).send({ message: err.message });
  }
});

app.get("/display/:id", async (req, res) => {
  try {
    const result = await user.findById(req.params.id);

    console.log(result.key);

    return res.status(200).json(result);
  } catch (err) {
    console.log("An error occured : " + err.message);
    return res.status(500).send({ message: err.message });
  }
});

app.get("/sign/:email/:password", async (req, res) => {
  try {
    const result = await log.findOne({
      email: req.params.email,
      password: req.params.password,
    });

    if (!result) {
      return res.status(404).send({ message: "An error occured" });
    }

    return res.status(200).json(result);
  } catch (err) {
    console.log("An error occured : " + err.message);
    return res.status(500).send({ message: err.message });
  }
});

app.get("/find/:id", async (req, res) => {
  try {
    const result = await user.findOne({
      uid: req.params.id,
    });

    if (!result) {
      return res.status(404).send({ message: "Not found" });
    }

    return res.status(200).json(result);
  } catch (err) {
    console.log("An error occured : " + err.message);
    return res.status(500).send({ message: err.message });
  }
});

app.get("/userName/:userName", async (req, res) => {
  try {
    const result = await user.findOne({
      userName: req.params.userName,
    });

    if (!result) {
      return res.status(200).send({ message: "Good to go..." });
    } else {
      return res.status(404).send({ message: "Username already in use..." });
    }
  } catch (err) {
    console.log("Error: " + err);
    return res.status(500).send({ message: err.message });
  }
});

app.get("/getFive/:id", async (req, res) => {
  const userId = req.params.id;
  console.log(userId);

  try {
    const result = await user.aggregate([{ $sample: { size: 3 } }]);

    // Use Array.filter to exclude the user with the specified id
    const filteredResult = result.filter((user) => String(user._id) !== userId);

    if (!filteredResult || filteredResult.length === 0) {
      console.log("Not found");
      return res.status(404).send({ message: "404 not found" });
    }

    return res.status(200).json(filteredResult);
  } catch (err) {
    console.log("Error from catch" + err.message);
    return res.status(500).send({ message: err.message });
  }
});

app.post("/post", upload.single("postPic"), async (req, res) => {
  console.log("Pic : ", req.file);
  const userData = JSON.parse(req.body.userData);
  console.log("Incoming request:", userData.uid);

  try {
    if (!userData.caption) {
      return res
        .status(400)
        .send({ message: "Please send all the required parameters..." });
    }

    let postInfo = {};
    console.log(req.filename);
    const filePath = path.join(__dirname, "uploads", req.file.filename);
    const fileContent = fs.readFileSync(filePath);

    const command = new PutObjectCommand({
      Bucket: process.env.bucket,
      Key: `post-pic/${req.file.originalname}`,
      ContentType: req.file.mimetype,
      Body: fileContent,
    });

    const url = await getSignedUrl(s3Client, command);
    console.log(url);

    let newData;

    await fetch(url, {
      method: "PUT",
      body: fileContent,
      headers: {
        "Content-Type": req.file.mimetype,
      },
    }).then((res) => {
      postInfo = {
        caption: userData.caption,
        uid: userData.uid,
        post: `post-pic/${req.file.originalname}`,
      };
    });

    fs.unlink(filePath, (err) => {
      console.log("The file was not unlinkled...");
    });

    const sta = await pictures.create(postInfo);
    return res.status(200).json(sta);
  } catch (err) {
    console.log("Error from catch of the server : " + err.message);
    return res.status(500).send({ message: err.message });
  }
});

app.get("/getPosts/:id", async (req, res) => {
  try {
    const result = await pictures.find({ uid: req.params.id });

    if (!result) {
      return res.status(404).send({ message: "No posts yet..." });
    }

    return res.status(200).json(result);
  } catch (err) {
    console.log(err.message);
    return res
      .status(500)
      .send({ message: "error from the catch of the server..." });
  }
});

app.get("/allposts", async (req, res) => {
  try {
    const result = await pictures.find({});

    if (!result) {
      return res.status(404).send({ message: "No posts till now..." });
    }

    return res.status(200).json(result);
  } catch (err) {
    console.log("Error from allposts: " + err.message);
    return res.status(500).send({ message: err.message });
  }
});

app.post("/comment", async (req, res) => {
  try {
    const result = await comments.create({
      myId: req.body.myId,
      commentFor: req.body.uid,
      comment: req.body.comment,
    });
    if (!result) {
      return result.status(400).send({ message: "An error occurred" });
    }
    return res.status(200).json({result, success : true});
  } catch (err) {
    console.log("An error accured : " + err.message);
    return res.status(500).send({ message: err.message });
  }
});

app.post("/reply", async (req, res) => {
  console.log("Comment for : " + req.body.uid);
  try {
    const result = await comments.create({
      myId: req.body.myId,
      commentFor: req.body.uid,
      comment: req.body.comment,
    });
    if (!result) {
      return result.status(400).send({ message: "An error occurred" });
    }
    return res.status(200).json({result, success : true});
  } catch (err) {
    console.log("An error accured : " + err.message);
    return res.status(500).send({ message: err.message });
  }
});

app.get("/comment/:commentFor", async (req, res) => {
  try {
    console.log(req.params.commentFor);
    const result = await comments.find({
         commentFor : req.params.commentFor
    }).populate('myId');

    console.log(result);

    if (!result) {
      return res.status(400).send({ message: "Not found any comment... " });
    }

    return res.status(200).json({result, success : true});
  } catch (err) {
    console.log("An error occured : " + err.message);
    return res.status(500).send({ message: err.message });
  }
});

app.put("/updateUser/:id", upload.single("profilePic"), async (req, res) => {
  const userData = JSON.parse(req.body.userData);
  console.log("Incoming request:", userData.uid);

  try {
    const existingUser = await user.findById(req.params.id);

    if (!existingUser) {
      return res.status(400).send({ message: "No user exists..." });
    }

    existingUser.name = userData.name || existingUser.name;
    existingUser.userName = userData.userName || existingUser.userName;
    existingUser.dis = userData.dis || existingUser.dis;

    if (req.file) {
      existingUser.profilePic = req.file.filename;
    }

    const updatedUser = await existingUser.save();

    return res.status(200).json(updatedUser);
  } catch (err) {
    console.log("An error occured...");
    return res.status(500).send({ message: err.message });
  }
});

app.post("/follow/:myId/:userId", async (req, res) => {
  try {
    const result = await followers.create({
      myId: req.params.myId,
      userId: req.params.userId,
    });

    let expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 2);

    const notify = await notification.create({
      myId: req.params.myId,
      userId: req.params.userId,
      type: "follow",
      message: `${req.body.username} followed you!`,
      expiresAt: expirationDate,
    });

    let notifyStatus = false;

    if (notify) {
      notifyStatus = true;
    } else notifyStatus = false;

    return res.status(200).json({ result, success: true, notifyStatus });
  } catch (err) {
    console.log("An error occurred : " + err.message);
    return res.status(500).send({ message: err.message });
  }
});

app.get("/follower/:myId/:userId", async (req, res) => {
  try {
    const result = await followers.findOne({
      myId: req.params.myId,
      userId: req.params.userId,
    });

    if (!result) {
      return res.status(400).send({ message: " Not found the user" });
    }

    return res.status(200).json(result);
  } catch (err) {
    console.log("An error occured!");
    return res.status(500).send({ message: err });
  }
});

app.get("/following/:myId", async (req, res) => {
  try {
    const result = await followers.find({
      myId: req.params.myId,
    });

    if (!result) {
      return res.status(404).send({ message: " Not found the user" });
    }

    const following = await Promise.all(
      result.map(async (follower) => {
        const userInfo = await user.findById(follower.userId);
        const posts = await pictures.find({ uid: follower.userId });

        if (posts.length > 0) {
          if (posts.length === 1) {
            return {
              user: userInfo,
              post: posts[0],
            };
          } else if (posts.length > 1) {
            const a = posts.map((post) => {
              return { post: post, user: userInfo };
            });

            return a;
          }
        } else {
          return null;
        }
      })
    );

    const filteredResults = following.filter((item) => item != null);

    return res.status(200).json(filteredResults);
  } catch (err) {
    console.log("An error occured!");
    return res.status(500).send({ message: err });
  }
});

app.get("/isFollowing/:myId/:userId", async (req, res) => {
  try {
    const result = await followers.findOne({
      myId: req.params.myId,
      userId: req.params.userId,
    });

    if (!result) {
      return res.status(404).send({ message: " Not found the user" });
    }

    return res.status(200).json({ result, status: true });
  } catch (err) {
    console.log("An error occured!");
    return res.status(500).send({ message: err });
  }
});

app.get("/noOfFollowers/:myId", async (req, res) => {
  try {
    const result = await followers
      .find({
        userId: req.params.myId,
      })
      .sort({ createdAt: -1 });

    if (!result) {
      return res.status(400).send({ message: " Not found the user" });
    }

    return res.status(200).json(result);
  } catch (err) {
    console.log("An error occured!");
    return res.status(500).send({ message: err });
  }
});

app.delete("/unFollow/:myId/:userId/:username", async (req, res) => {
  try {
    const result = await followers.deleteOne({
      myId: req.params.myId,
      userId: req.params.userId,
    });

    let expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 1);

    const notify = await notification.create({
      myId: req.params.myId,
      userId: req.params.userId,
      type: "unfollow",
      message: `${req.params.username} unfollowed you!`,
      expiresAt: expirationDate,
    });

    let notifyStatus = false;

    if (notify) {
      notifyStatus = true;
    } else notifyStatus = false;

    return res.status(200).json({ result, success: true, notifyStatus });
  } catch (err) {
    console.log(err);
    return res.status(500).send({ message: err.message });
  }
});

app.get("/getNoComment/:myId", async (req, res) => {
  try {
    const result = await comments.find({
      userId: req.params.myId,
    });

    if (!result) {
      return res.status(400).send({ message: "Not found any comment... " });
    }

    return res.status(200).json(result);
  } catch (err) {
    console.log("An error occured : " + err.message);
    return res.status(500).send({ message: err.message });
  }
});

app.post("/like/:myId/:userId", async (req, res) => {
  try {
    const result = await likes.create({
      myId: req.params.myId,
      userId: req.params.userId,
    });

    return res.status(200).json(result);
  } catch (err) {
    console.log("An error occured!");
    return res.status(500).send({ message: "An error occured!" });
  }
});

app.get("/likes/:myId", async (req, res) => {
  try {
    const result = await likes
      .find({
        userId: req.params.myId,
      })
      .sort({ createdAt: -1 });

    if (!result) {
      return res.status(400).send({ message: "No likes yet..." });
    }

    return res.status(200).json(result);
  } catch (err) {
    console.log("An error occured!");
    return res.status(500).send({ message: "An error occured!" });
  }
});

app.delete("/unLike/:myId/:userId", async (req, res) => {
  try {
    const result = await followers.deleteOne({
      myId: req.params.myId,
      userId: req.params.userId,
    });

    return res.status(200).json(result);
  } catch (err) {
    console.log(err);
    return res.status(500).send({ message: err.message });
  }
});

app.post("follow/:id", async (req, res) => {
  try {
    const follow = await followers.insertOne({
      myId: req.body.myId,
      userId: req.params.id,
    });

    if (follow) {
      return res.status(500).json({
        message: "There was a problem while following please try again...",
      });
    }

    console.log(follow);

    return res.status(200).json({ message: follow, success: true });
  } catch (err) {
    console.log(err);
    return res.status(500).send({ message: err.message });
  }
});

app.get("/profilePic/:key1/:key2", async (req, res) => {
  try {
    let url = await getObjectURL(`${req.params.key1}/${req.params.key2}`);

    if (!url) {
      return res.status(404).json({ message: "Not found the url!!" });
    }

    return res.status(200).json({ url: url, success: true });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "There was an error from the server..." });
  }
});

app.get("/notifications/:id", async (req, res) => {
  try {
    const notifications = await notification
      .find({
        userId: req.params.id,
      })
      .populate("myId");

    if (!notifications) {
      return res.status(404).json({ message: "No notification currently..." });
    }

    return res.status(200).json({ success: true, notifications });
  } catch (err) {
    return res.status(500).json({
      message: "There was an error while getting the notifications...",
    });
  }
});
app.get("/removeNotification/:id", async (req, res) => {
  try {
    const notifications = await notification
      .deleteOne({
        _id: req.params.id,
      })
      .populate("myId");

    if (!notifications) {
      return res.status(404).json({ message: "No notification currently..." });
    }

    return res.status(200).json({ success: true, notifications });
  } catch (err) {
    return res.status(500).json({
      message: "There was an error while removing the notifications...",
    });
  }
});

const bcrypt = require("bcrypt");
const express = require("express");
const app = express();
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const jwt = require("jsonwebtoken");
app.use(express.json());
const path = require("path");

const dbPath = path.join(__dirname, "twitterClone.db");
let db = null;

const intializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3001, () =>
      console.log("Server is running in http://localhost:3001")
    );
  } catch (error) {
    console.log(`DB Error : ${error.message}`);
    process.exit(1);
  }
};

intializeDbAndServer();

//newUserAPI

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;

  const getUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(getUserQuery);
  const hashedPassword = await bcrypt.hash(password, 10);

  if (dbUser !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const addNewUserQuery = `
            INSERT INTO user(username,password,name,gender)
            VALUES ('${username}','${hashedPassword}','${name}','${gender}');
            `;
      db.run(addNewUserQuery);
      response.send("User created successfully");
    }
  }
});

//loginAPI

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(getUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_KEY");
      response.send({ jwtToken });
      console.log(jwtToken);
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

let middlewareFunction = (request, response, next) => {
  let jwtToken;
  let authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  console.log(jwtToken);
  if (jwtToken !== undefined) {
    jwt.verify(jwtToken, "MY_SECRET_KEY", async (error, payload) => {
      if (error) {
        console.log(payload);
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        console.log(payload);
        request.username = payload.username;
        next();
      }
    });
  } else {
    response.status(401);
    response.send("Invalid JWT Token");
  }
};

//API3
app.get("/user/tweets/feed/", middlewareFunction, async (request, response) => {
  const username = request.username;
  const userIdQuery = `SELECT user_id FROM user WHERE username = '${username}'`;
  let getUserId = await db.get(userIdQuery);
  let userId = getUserId.user_id;
  const getQuery = `
    SELECT user.username AS username,tweet.tweet AS tweet,tweet.date_time AS dateTime
    FROM (follower INNER JOIN tweet ON follower.following_user_id = tweet.user_id) AS t JOIN user ON t.user_id = user.user_id
    WHERE t.follower_user_id = ${userId}
    ORDER BY t.date_time DESC
    LIMIT 4;`;

  const tweetArray = await db.all(getQuery);
  response.send(tweetArray);
});

//API 4
app.get("/user/following/", middlewareFunction, async (request, response) => {
  const { username } = request;
  const userIdQuery = `SELECT user_id FROM user WHERE username = '${username}'`;
  let getUserId = await db.get(userIdQuery);
  let userId = getUserId.user_id;
  const getQuery = `
  SELECT user.name AS name
  FROM user JOIN follower ON user.user_id = follower.following_user_id
  WHERE follower.follower_user_id = ${userId};`;

  const result = await db.all(getQuery);
  response.send(result);
});

//API 5
app.get("/user/followers/", middlewareFunction, async (request, response) => {
  const { username } = request;
  const userIdQuery = `SELECT user_id FROM user WHERE username = '${username}'`;
  let getUserId = await db.get(userIdQuery);
  let userId = getUserId.user_id;
  const getQuery = `
  SELECT user.name AS name
  FROM user JOIN follower ON user.user_id = follower.follower_user_id
  WHERE follower.following_user_id = ${userId};`;

  const result = await db.all(getQuery);
  response.send(result);
});

//API 6
app.get("/tweets/:tweetId/", middlewareFunction, async (request, response) => {
  const { tweetId } = request.params;
  const { username } = request;
  const userIdQuery = `SELECT user_id FROM user WHERE username = '${username}'`;
  let getUserId = await db.get(userIdQuery);
  let userId = getUserId.user_id;
  const tweetUserQuery = `
  SELECT user_id
  FROM tweet
  WHERE tweet_id = ${tweetId};`;

  const tweetUserResponse = await db.get(tweetUserQuery);
  const tweetUser = tweetUserResponse.user_id;

  const isFollowingQuery = `
  SELECT * 
  FROM follower
  WHERE follower_user_id= ${userId} AND following_user_id=${tweetUser};`;

  const isFollowing = await db.get(isFollowingQuery);

  if (isFollowing === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const getQuery = `
      SELECT tweet.tweet,COUNT(like.like_id) AS likes,COUNT(reply.reply_id) AS replies,tweet.date_time AS dateTime
      FROM (tweet JOIN like ON tweet.tweet_id = like.tweet_id) AS t JOIN reply ON t.tweet_id = reply.tweet_id
      WHERE tweet.tweet_id= ${tweetId}`;

    const result = await db.get(getQuery);
    response.send(result);
  }
});

app.get(
  "/tweets/:tweetId/likes/",
  middlewareFunction,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    const userIdQuery = `SELECT user_id FROM user WHERE username = '${username}'`;
    let getUserId = await db.get(userIdQuery);
    let userId = getUserId.user_id;

    const tweetUserIdQuery = `
    SELECT user_id 
    FROM tweet
    WHERE tweet.user_id = ${userId};`;

    const tweetUserIdResponse = await db.get(tweetUserIdQuery);
    const tweetUserId = tweetUserIdResponse.user_id;

    const isFollowingQuery = `
    SELECT * 
    FROM follower
    WHERE follower_user_id = ${userId} AND following_user_id = ${tweetUserId};`;

    const isFollowing = await db.get(isFollowingQuery);
    console.log(isFollowing);
    if (isFollowing === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const getQuery = `SELECT username FROM user JOIN like ON user.user_id = like.user_id
        WHERE tweet_id = ${tweetUserId};`;

      const result = await db.all(getQuery);
      const usernameList = result.map((each) => {
        return each.username;
      });
      response.send({
        likes: usernameList,
      });
    }
  }
);

//API8

app.get(
  "/tweets/:tweetId/replies/",
  middlewareFunction,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    const userIdQuery = `SELECT user_id FROM user WHERE username = '${username}'`;
    let getUserId = await db.get(userIdQuery);
    let userId = getUserId.user_id;

    const tweetUserIdQuery = `
    SELECT user_id 
    FROM tweet
    WHERE tweet.user_id = ${userId};`;

    const tweetUserIdResponse = await db.get(tweetUserIdQuery);
    const tweetUserId = tweetUserIdResponse.user_id;

    const isFollowingQuery = `
    SELECT * 
    FROM follower
    WHERE follower_user_id = ${userId} AND following_user_id = ${tweetUserId};`;

    const isFollowing = await db.get(isFollowingQuery);
    console.log(isFollowing);
    if (isFollowing === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const getQuery = `
        SELECT name,reply
        FROM user JOIN reply ON user.user_id = reply.user_id
        WHERE tweet_id = ${tweetUserId};`;

      const result = await db.all(getQuery);
      response.send({
        replies: result,
      });
    }
  }
);

//API9

app.get("/user/tweets/", middlewareFunction, async (request, response) => {
  const { username } = request;
  const getUserQuery = `SELECT user_id FROM user WHERE username = '${username}';`;
  const userIdResponse = await db.get(getUserQuery);
  const userId = userIdResponse.user_id;

  const getQuery = `
    SELECT tweet.tweet, COUNT(like.user_id) AS likes,COUNT(reply.user_id) AS replies,date_time AS dateTime
    FROM (tweet JOIN like ON tweet.user_id = like.user_id) AS t JOIN reply ON t.user_id = reply.user_id
    WHERE tweet.user_id = ${userId};
    `;

  const result = await db.all(getQuery);
  response.send(result);
});

//API 10
app.post("/user/tweets/", middlewareFunction, async (request, response) => {
  const { username } = request;
  const getUserQuery = `SELECT user_id FROM user WHERE username = '${username}';`;
  const userIdResponse = await db.get(getUserQuery);
  const userId = userIdResponse.user_id;
  console.log(userId);

  const { tweet } = request.body;

  let now = new Date();
  const createDateTime = `${now.getFullYear()}-${
    now.getMonth() + 1
  }-${now.getDate()} ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;

  const postQuery = `
  INSERT INTO tweet(tweet,user_id,date_time)
  VALUES ('${tweet}',${userId},'${createDateTime}');`;

  await db.run(postQuery);
  response.send("Created a Tweet");
});

//API 11
app.delete(
  "/tweets/:tweetId/",
  middlewareFunction,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    const getUserQuery = `SELECT user_id FROM user WHERE username = '${username}';`;
    const userIdResponse = await db.get(getUserQuery);
    const userId = userIdResponse.user_id;

    const isUserTweetQuery = `SELECT * FROM user JOIN tweet ON user.user_id = tweet.user_id
    WHERE user.user_id = ${userId} AND tweet_id = ${tweetId};`;

    const isUserTweet = await db.get(isUserTweetQuery);

    if (isUserTweet === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const deleteQuery = `DELETE FROM tweet 
        WHERE tweet_id = ${tweetId};`;
      await db.run(deleteQuery);
      response.send("Tweet Removed");
    }
  }
);

module.exports = app;

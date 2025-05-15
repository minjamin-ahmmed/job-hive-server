const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const logger = (req, res, next) => {
  console.log("log Info");
  next();
};

const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: "Unauthorized Access" });
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorized Access" });
    }
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pinqi.mongodb.net/job-hive?retryWrites=true&w=majority`;

console.log(process.env.DB_USER, process.env.DB_PASS);

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.get("/", (req, res) => {
  res.send("Job is falling behind schedule!");
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    // Auth Related API
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: false,
        })
        .send({ success: true });
    });

    //Jobs Related API
    const jobsCollection = client.db("job-hive").collection("jobs");
    const jobApplicationCollection = client
      .db("job-hive")
      .collection("job-application");

    app.get("/jobs", logger, async (req, res) => {
      const email = req.query.email;
      let query = {};
      if (email) {
        query = { hr_email: email };
      }
      const cursor = jobsCollection.find(query);
      const jobs = await cursor.toArray();
      res.send(jobs);
    });

    app.get("/jobs/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobsCollection.findOne(query);
      res.send(result);
    });

    app.post("/jobs", async (req, res) => {
      const job = req.body;
      const result = await jobsCollection.insertOne(job);
      res.send(result);
    });

    // Job Application API
    app.get("/job-applications", verifyToken, async (req, res) => {
      const email = req.query.email;

      const query = { email: email };

      console.log("COOKIES Cookies", req.cookies);

      const result = await jobApplicationCollection.find(query).toArray();

      // Aggregate data (Not Best way to do it)
      for (const applications of result) {
        console.log("fsrdg", applications.jobId);
        const query1 = { _id: new ObjectId(applications.jobId) };
        const job = await jobsCollection.findOne(query1);
        if (job) {
          applications.title = job.title;
          applications.location = job.location;
          applications.company = job.company;
          applications.company_logo = job.company_logo;
          applications.applicationDeadline = job.applicationDeadline;
        }
      }

      res.send(result);
    });

    app.post("/job-applications", async (req, res) => {
      const jobApplication = req.body;
      const result = await jobApplicationCollection.insertOne(jobApplication);
      res.send(result);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

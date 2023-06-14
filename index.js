const express = require("express");
const app = express();
const cors = require("cors")
const jwt = require('jsonwebtoken')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const port = process.env.PORT || 5000;

app.use(cors())
app.use(express.json())


// Verify JWT
const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' });
    }

    const token = authorization.split(' ')[1]
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
    })
}




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.j52gohc.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const userCollection = client.db("sportifyDb").collection("users");
        const classCollection = client.db("sportifyDb").collection("classes");
        const selectedClassCollection = client.db("sportifyDb").collection("selected");

        // JWT
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ token })
        })


        // Verify Admin
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }
        // Verify Instructor
        const verifyInstructor = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            if (user?.role !== 'instructor') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }

        // User related API
        app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result)
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'User already exists' })
            }
            const result = await userCollection.insertOne(user);
            res.send(result)
        })

        // Admin User
        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            if (req.decoded?.email !== email) {
                res.send({ admin: false })
            }
            const query = { email: email }
            const user = await userCollection.findOne(query);
            const result = { admin: user?.role === 'admin' }
            res.send(result)
        })

        // Instructor User
        app.get('/users/instructors/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            if (req.decoded?.email !== email) {
                res.send({ instructor: false })
            }
            const query = { email: email }
            const user = await userCollection.findOne(query);
            const result = { instructor: user?.role === 'instructor' }
            res.send(result)
        })

        // All Instructors
        app.get('/instructors', async (req, res) => {
            const result = await userCollection.find({ role: 'instructor' }).toArray();
            res.send(result)
        })

        // Set Admin Role
        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const update = {
                $set: {
                    role: 'admin'
                },
            }
            const result = await userCollection.updateOne(filter, update)
            res.send(result)
        })

        // Set Instructor Role
        app.patch("/users/instructors/:id", async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const update = {
                $set: {
                    role: "instructor",
                },
            };
            const result = await userCollection.updateOne(filter, update);
            res.send(result);
        });

        // Class Collection API

        // TODO: STATUS APPROVED
        // Get all classes (public)
        app.get('/classes', async (req, res) => {
            const result = await classCollection.find({ status: 'pending' }).toArray()
            res.send(result)
        })

        // add new classes
        app.post('/classes', verifyJWT, verifyInstructor, async (req, res) => {
            const addClass = req.body;
            const result = await classCollection.insertOne(addClass);
            res.send(result)

        })

        // Selected class by students

        app.get('/classes/selected/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const query = { studentEmail: email }
            const result = await selectedClassCollection.find(query).toArray();
            res.send(result);
        })
        app.post('/classes/selected', verifyJWT, async (req, res) => {
            const selectedClass = req.body;
            const id = selectedClass._id;
            const query = { _id: id }
            const existingClass = await selectedClassCollection.findOne(query);
            // console.log(existingClass)
            if (existingClass) {
                return res.send({ message: 'already selected' })
            }
            const result = await selectedClassCollection.insertOne(selectedClass);
            res.send(result);

        })

        app.delete('/classes/selected/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: id };
            console.log(query)
            const result = await selectedClassCollection.deleteOne(query);
            res.send(result);
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Sportify Camp server is running')
})
app.listen(port, () => {
    console.log(`Sportify server is running at port: ${port}`)
})

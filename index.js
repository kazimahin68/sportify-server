const express = require("express");
const app = express();
const cors = require("cors")
const jwt = require('jsonwebtoken')
const stripe = require("stripe")('sk_test_51NJ1TQAL2rmJJYlw3iZVxwL5E7sAKITtpdoG1mesSmVDJIxHYXTjhSaBRUfHfv4KXEfPGtOEgBcOAQ5AdW38aXeW00iwRd1nSX')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const port = process.env.PORT || 5000;

app.use(cors())
app.use(express.static("public"));
app.use(express.json())


console.log(process.env.PAYMENT_SECRET_KEY)
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
        const paymentCollection = client.db("sportifyDb").collection("payments");

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

        // app.patch('/classes/:id', verifyJWT, async (req, res) => {
        //     const id = req.params.id;
        //     const {seats, enrolled} = req.body;
        //     const filter = {_id: new Object(id)};
        //     console.log(id, filter)
        //     // const options = {upsert: true}
        //     const updateClass = {
        //         $inc : {
        //             seats: seats,
        //             enrolled: enrolled
        //         }
        //     }
        //     console.log(updateClass)
        //     const result = await classCollection.updateOne(filter, updateClass)
        //     res.send(result)
        // })

        // Selected class by students

        app.get('/classes/selected/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const query = { studentEmail: email }
            const result = await selectedClassCollection.find(query).toArray();
            res.send(result);
        })

        app.get('/classes/payment/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            // console.log(id)
            const query = { _id: new ObjectId(id) }
            // console.log(query)
            const result = await classCollection.findOne(query)
            // console.log(result)
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
            // console.log(query)
            const result = await selectedClassCollection.deleteOne(query);
            res.send(result);
        })



        // Payment Intent
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret,
            })
        })

        // Payment API
        app.post('/payments', verifyJWT, async (req, res) => {
            const payment = req.body;
            // console.log(payment)
            const insertResult = await paymentCollection.insertOne(payment);
            const query = { _id: payment.id }
            const selectedClassId = payment.id;
            const filter = { _id: new ObjectId(selectedClassId)}
            // console.log(query, filter)
            const update = {
                $inc: {
                    seats: -1,
                    enrolled: 1
                }
            }
            const updateResult = await classCollection.updateOne(filter, update)
            const deleteResult = await selectedClassCollection.deleteOne(query)
            res.send({ insertResult, updateResult, deleteResult })
            // console.log(updateResult)
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

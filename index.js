const express = require("express");
const app = express();
const cors = require("cors")
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const port = process.env.PORT || 5000;

app.use(cors())
app.use(express.json())





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


        // User related API
        app.get('/users', async(req, res) =>{
            const result = await userCollection.find().toArray();
            res.send(result)
        })

        app.post('/users', async(req, res) =>{
            const user = req.body;
            const query = {email : user.email}
            const existingUser = await userCollection.findOne(query);
            if(existingUser){
                return res.send({message: 'User already exists'})
            }
            const result = await userCollection.insertOne(user);
            res.send(result)
        })

        app.patch('/users/admin/:id', async(req, res) =>{
            const id = req.params.id;
            const filter = {_id: new ObjectId(id)}
            const update = {
                $set: {
                    role: 'admin'
                }, 
            }
            const result = await userCollection.updateOne(filter, update)
            res.send(result)
        })
        app.patch("/users/instructor/:id", async (req, res) => {
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

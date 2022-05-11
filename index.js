const express = require('express');
const app = express();
const port = process.env.PORT || 5000;
const cors = require('cors');
require('dotenv').config();

app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.egk8m.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

const run = async () => {
    try {
        await client.connect();
        const serviceCollection = client.db("doctors_portal").collection("services");

        app.get('/service', async (req, res) => {
            try {
                const query = {};
                const cursor = serviceCollection.find(query);
                const services = await cursor.toArray();
                res.send(services);
            }
            catch (err) {
                console.log(err.message);
                res.status(500).send({ error: "There was a server side error" });
            }
        });

    }
    catch (err) {
        console.log(err.message);
    }
};
run();


app.get('/', (req, res) => {
    res.send("Hello!How are you?");
});

app.listen(port, () => {
    console.log(`Listening to the port ${port}`);
});
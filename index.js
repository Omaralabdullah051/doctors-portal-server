const express = require("express");
const app = express();
const port = process.env.PORT || 5000;
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const nodemailer = require("nodemailer");

const corsConfig = {
  origin: true,
  credentials: true,
};
app.use(cors(corsConfig));
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "UnAuthorized access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    req.decoded = decoded;
  });
  next();
};

//*for sending email
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_SENDER,
    pass: process.env.EMAIL_PASS,
  },
});

function sendAppointmentEmail(booking) {
  const { patient, patientName, treatment, date, slot } = booking;

  const email = {
    from: process.env.EMAIL_SENDER,
    to: patient,
    subject: `Your Appointment for ${treatment} is on ${date} at ${slot} is confirmed`,
    text: `Your Appointment for ${treatment} is on ${date} at ${slot} is confirmed`,
    html: `
      <div>
        <p> Hello ${patientName}, </p>
        <h3>Your Appointment for ${treatment} is confirmed</h3>
        <p>Looking forward to seeing you on ${date} at ${slot}</p>

        <h3>Our Address</h3>
        <p>Andor Killa Bandorban</p>
        <a href="https://web.programming-hero.com/web-5/video/web-5-76-8-optional-set-email-after-appointment-confirmation">Unsubscribe</a>
      </div>
    `,
  };

  transporter.sendMail(email, function (err, info) {
    if (err) {
      console.log(err);
    } else {
      console.log("Email sent:" + info);
    }
  });
}

//*we just make a template for sending this email as an example. because we already test another.
function sendPaymentConfirmationEmail(booking) {
  const { patient, patientName, treatment, date, slot } = booking;

  const email = {
    from: process.env.EMAIL_SENDER,
    to: patient,
    subject: `We have received your payement for ${treatment} is on ${date} at ${slot} is confirmed`,
    text: `We have received your payement for ${treatment} is on ${date} at ${slot} is confirmed`,
    html: `
      <div>
        <p> Hello ${patientName}, </p>
        <h3>Thank you for your payment</h3>
        <p>Looking forward to seeing you on ${date} at ${slot}</p>

        <h3>Our Address</h3>
        <p>Andor Killa Bandorban</p>
        <p>Bangladesh</p>
        <a href="https://web.programming-hero.com/web-5/video/web-5-76-8-optional-set-email-after-appointment-confirmation">Unsubscribe</a>
      </div>
    `,
  };

  transporter.sendMail(email, function (err, info) {
    if (err) {
      console.log(err);
    } else {
      console.log("Email sent:" + info);
    }
  });
}

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { cookie } = require("express/lib/response");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.egk8m.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

const run = async () => {
  try {
    await client.connect();
    const serviceCollection = client
      .db("doctors_portal")
      .collection("services");
    const bookingCollection = client
      .db("doctors_portal")
      .collection("bookings");
    const userCollection = client.db("doctors_portal").collection("users");
    const doctorCollection = client.db("doctors_portal").collection("doctors");
    const paymentCollection = client
      .db("doctors_portal")
      .collection("payments");

    const verifyAdmin = async (req, res, next) => {
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({
        email: requester,
      });
      if (requesterAccount.role === "admin") {
        next();
      } else {
        return res.status(403).send({ message: "forbidden" });
      }
    };

    app.get("/service", async (req, res) => {
      try {
        const query = {};
        const cursor = serviceCollection.find(query).project({ name: 1 });
        const services = await cursor.toArray();
        res.send(services);
      } catch (err) {
        console.log(err.message);
        res.status(500).send({ error: "There was a server side error" });
      }
    });

    app.get("/user", verifyJWT, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });

    app.put("/user/admin/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const updatedDoc = {
        $set: { role: "admin" },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      return res.send(result);
    });

    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === "admin";
      res.send({ admin: isAdmin });
    });

    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updatedDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        {
          expiresIn: process.env.JWT_EXPIRY,
        }
      );

      return res.send({ result, token });
    });

    /*
     * API Naming Convention
     * app.get('/booking') //get all bookings in this collection, or get more than one or by filter
     * app.get('/booking/:id') //get a specific booking
     * app.post('/booking') //add a new booking
     * app.patch('/booking/:id')
     * app.put('/booking/:id') //upsert > update (if exist) or insert (if doesn't exist)
     * app.delete('/booking/:id')
     */

    //Warning:
    //This is not the proper way to query
    //After learning more about mongodb, use aggregate lookup, pipeline, match,group
    app.get("/available", async (req, res) => {
      const date = req.query.date;

      //step 1: get all services
      const services = await serviceCollection.find().toArray();

      //step 2: get the booking of that day
      const query = { date: date };
      const bookings = await bookingCollection.find(query).toArray();

      //step 3: for each service,
      services.forEach((service) => {
        //step 4: find bookings for that service
        const serviceBookings = bookings.filter(
          (book) => book.treatment === service.name
        );
        //step 5: select slots for the service bookings:
        const bookedSlots = serviceBookings.map((book) => book.slot);
        //step 6: select those slots that are not in bookedSlots
        const available = service.slots.filter(
          (slot) => !bookedSlots.includes(slot)
        );
        //step 7: set available to slots to make it easier
        service.slots = available;
      });

      res.send(services);
    });

    app.get("/booking", verifyJWT, async (req, res) => {
      const patient = req.query.patient;
      const decodedEmail = req.decoded?.email;
      if (patient === decodedEmail) {
        const query = { patient: patient };
        const bookings = await bookingCollection.find(query).toArray();
        return res.send(bookings);
      } else {
        res.status(403).send({ messaage: "Forbidden access" });
      }
    });

    app.post("/booking", async (req, res) => {
      const booking = req.body;
      const query = {
        treatment: booking.treatment,
        date: booking.date,
        patient: booking.patient,
      };
      const exists = await bookingCollection.findOne(query);
      if (exists) {
        return res.send({ success: false, booking: exists });
      }
      const result = await bookingCollection.insertOne(booking);
      console.log("sending email");
      sendAppointmentEmail(booking);
      res.send({ success: true, result });
    });

    app.post("/doctor", verifyJWT, verifyAdmin, async (req, res) => {
      const doctor = req.body;
      const result = await doctorCollection.insertOne(doctor);
      res.send(result);
    });

    app.get("/doctor", verifyJWT, verifyAdmin, async (req, res) => {
      const doctors = await doctorCollection.find().toArray();
      res.send(doctors);
    });

    app.delete("/doctor/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const doctors = await doctorCollection.deleteOne(filter);
      res.send(doctors);
    });

    app.get("/booking/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const booking = await bookingCollection.findOne(query);
      res.send(booking);
    });

    app.patch("/booking/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const payment = req.body;
      const filter = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId,
        },
      };
      const result = await paymentCollection.insertOne(payment);
      const updatedBooking = await bookingCollection.updateOne(
        filter,
        updatedDoc
      );
      res.send(updatedDoc);
    });

    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const service = req.body;
      const price = service.price;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });
  } catch (err) {
    console.log(err.message);
  }
};
run();

app.get("/", (req, res) => {
  res.send("Hello!How are you?");
});

app.listen(port, () => {
  console.log(`Listening to the port ${port}`);
});

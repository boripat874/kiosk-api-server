const express = require("express"); // Express web framework
const swaggerUi = require("swagger-ui-express"); // Swagger UI middleware
const YAML = require('yamljs'); // YAML parser for Swagger
const apiBackoffice = require("./router/backoffice"); // Backoffice routes
const apiKiosk = require("./router/kiosk"); // Kiosk routes
const app = express(); // Create Express app
const cors = require("cors"); // CORS middleware
const xmlparser = require('express-xml-bodyparser');

require("dotenv").config(); // Load environment variables

// Use the XML body parser middleware
app.use(xmlparser());

const swaggerDocument = YAML.load('./API_KIOSK_System.yml');

app.use(cors());
app.use(express.urlencoded({ extended: true }))
app.use(express.json()); 

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use("/api", apiBackoffice);
app.use("/api-kiosk", apiKiosk);

const xml2js = require('xml2js');
const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });

const axios = require('axios');

app.get("/apitest", async (req, res) => {

    await axios.get('https://api.thecatapi.com/v1/images/search')

    .then(response => {
        // console.log(response.data);
        const currentDate = new Date();
        currentDate.setDate(currentDate.getDate() + 1);

        // console.log(date.format(new Date(), "YYYY-MM-DD"));
        // res.json({ message: response.data });

        res.send(
// `<?xml version="1.0" encoding="UTF-8" ?>
`
<?xml version="1.0" encoding="UTF-8" ?>
<framed_ip_address>192.168.203.60</framed_ip_address>
<auth_acs_timestamp>2025-09-02T12:00:00.405+07:00</auth_acs_timestamp>
<framed_ip_address>192.168.203.60</framed_ip_address>
<auth_acs_timestamp>2025-09-02T12:00:00.405+07:00</auth_acs_timestamp>
`
// <ns3:searchResult total="1" xmlns:ns5="ers.ise.cisco.com" xmlns:ers-v2="res-v2" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:ns3="v2.ers.ise.cisco.com">
//     <ns3:resources>
//         <ns5:resource>

//             <ns5:resource description="Default" id="3b422b21-90f1-49d5-a3b2-c1b1b71cf933" name="Sponsor Portal">
//                 <link href="https://api.thecatapi.com/v1/images/search/3b422b21-90f1-49d5-a3b2-c1b1b71cf933"></link>
//             </ns5:resource>

//         </ns5:resource>
//     </ns3:resources>
// </ns3:searchResult> 
// <ns3:searchResult total="1" xmlns:ns5="ers.ise.cisco.com" xmlns:ers-v2="res-v2" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:ns3="v2.ers.ise.cisco.com">
//     <ns3:resources>
//         <ns5:resource>

//             <ns5:resource description="Default" id="3b422b21-90f1-49d5-a3b2-c1b1b71cf98985656" name="Sponsor Portal">
//                 <link href="https://api.thecatapi.com/v1/images/search/3b422b21-90f1-49d5-a3b2-c1b1b71cf933"></link>
//             </ns5:resource>

//         </ns5:resource>
//     </ns3:resources>
// </ns3:searchResult>`
            );
    })
    .catch(error => {
        res.json({ message: error });
        console.log(error);
    });
});

app.get("/apitestxml", async (req, res) => {

    await axios.get('http://localhost:5002/apitest')
    .then(response => {

        console.log(response.data);

        // const currentDate = new Date();
        // currentDate.setDate(currentDate.getDate() + 1);

        const regex = /<framed_ip_address>(.*?)<\/framed_ip_address>[\s\S]*?<auth_acs_timestamp>(.*?)<\/auth_acs_timestamp>/g;
        const resultArray = [];
        let match;

        while ((match = regex.exec(response.data)) !== null) {
            resultArray.push({
                "framed_ip_address": match[1],
                "auth_acs_timestamp": match[2]
            });
        }

        const result = resultArray;
        
        res.send({
            "result": result,

        })
        // console.log();

        // parser.parseString(response.data, (err, result) => {

        //     if (err) {
        //         console.error('Error parsing XML:', err);
        //         return;
        //     }

        //     console.log(result);

        //     // Access the id
        //     // const id = result.framed_ip_address;

        //     // const result.auth_acs_timestamp;

        //     // console.log(id);
        //     // Output: 3b422b21-90f1-49d5-a3b2-c1b1b71cf933
        //     res.send({
        //         result: result
        //     })
        // });
    })
    .catch(error => {
        res.json({ message: error });
        console.log(error);
    });
});

app.get("/apitestxmlget", async (req, res) => {

    console.log(req.body);

    res.send(req.body);
});

// หน้าแรก
app.get("/", (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>POS Server Status</title>
            <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🏃</text></svg>">
            <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
        </head>

        <body style="display: flex; 
            justify-content: center; 
            align-items: center; 
            height: 100vh; 
            margin: 0; 
            font-family: 
            sans-serif; 
            font-size: 2em;
        ">

            <div
                class="text-3xl font-bold  text-clifford animate-pulse duration-500"

                style="
                    background-color: #3EB776;
                    color: #fff;
                    padding: 20px;
                    border-radius: 10px;
                    text-align: center;
                ">
                
            🏃Kiosk Server is running!
            </div>
        </body>
        </html>
    `);
});

// Start the server
const port = process.env.Port;
app.listen(port, function () {
    console.log(`✅ Server is running on http://localhost:${port}`);
});
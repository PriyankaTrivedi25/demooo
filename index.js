const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const translatte = require("translatte");
const MultiKeyCache = require("multi-key-cache");
const multiKeyCache = new MultiKeyCache();
const MongoClient = require("mongodb").MongoClient;
const config = require("./config")
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());

const translation = async (text, surce_langauge, target_langauge) => {
  return new Promise((resolve, reject) =>
    translatte(text, { from: surce_langauge, to: target_langauge })
      .then((res) => {
        resolve(res.text);
      })
      .catch((err) => {
        reject(err.message);
      })
  );
};

//functoin for checking data is not null
function isSet(obj) {
  if (obj && obj != "null" && obj != undefined && obj !== "" && obj != "[]" && obj != [] && obj != {} && obj !== "" && obj != "undefined") {
      if (typeof obj != "undefined") {
          return true;
      }
  }
  return false;
}
app.post("/translate", async (req, res) => {
  var { text, surce_langauge, target_langauge } = req.body;

  //validation for text, sorce language and target language
  if(!isSet(text)){
    return res.json({ status: 400, success: false, message: "Input Text is Missing" });
  }

  if(!isSet(surce_langauge)){
    return res.json({ status: 400, success: false, message: "Source Language is Missing" });
  }

  if(!isSet(target_langauge)){
    return res.json({ status: 400, success: false, message: "Target Language is Missing" });
  }

  text = text.trim();
  surce_langauge = surce_langauge.trim();
  target_langauge = target_langauge.trim();

  try {
    var result,
      key = [text, surce_langauge, target_langauge];

    //Find data in catch
    if (multiKeyCache.has(key)) {
      result = multiKeyCache.get(key);
      console.log("Result from cache");
      return res.json({ status: 200, data:result });
    } else {

      //database connection
      MongoClient.connect(config.db_url, async function (err, db) {
        try{
          if (err) {
            console.log(err);
            return res.json({
              status: 500,
              success: false,
              message: err.message,
            });
          } else {

            console.log("connected with db")
            let dbase = db.db(config.database);
            let collection = dbase.collection(config.collection);

            //finding data in existing records
            result = await collection.findOne({
              input_text: text,
              target_langauge: target_langauge,
              surce_langauge: surce_langauge,
            });
            console.log("Result From Database")


            if (result === null) {

              //fetch result from translation'
              result = await translation(text, surce_langauge, target_langauge);

              //add data into catch
              multiKeyCache.set(key, result);

              //insert data into collction
              await collection.insertOne({
                input_text: text,
                "target_langauge": target_langauge,
                "surce_langauge": surce_langauge,
                output_text: result,
              });
              console.log(`Record inserted!`);

            }else{
              result = result.output_text
            }

            db.close();

        console.log(result);
        return res.json({ status: 200, data:result });
          }

        }          
          catch (err) {
            var _err=err
            if(isSet(err) && isSet(err.message)){
              _err= err.message
            }
            return res.json({ status: 200, success: false, message: _err});
          }
      });

    }

  } catch (err) {
    return res.json({ status: 200, success: false, message: err});
  }
});
app.listen(3000, async () => {
  console.log("Server successfully started on port 3000");
});

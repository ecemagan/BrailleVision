const { convertToBraille } = require("./lib/convertToBraille");
try {
  console.log(convertToBraille("merhaba dunya"));
} catch(e) {
  console.log("Error:", e.message);
}

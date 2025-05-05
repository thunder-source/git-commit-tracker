require("dotenv").config({ path: __dirname + "/.env" });
const axios = require("axios");

const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.error("No token found in environment variables");
  process.exit(1);
}

axios
  .get("https://api.github.com/user", {
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
  })
  .then((response) => {
    console.log("Token is valid!");
    console.log("User information:", response.data.login);
  })
  .catch((error) => {
    console.error("Token validation failed:");
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error("Error:", error.response.data);
    } else {
      console.error("Error:", error.message);
    }
  });

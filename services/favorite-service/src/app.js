const express = require("express");

const app = express();
app.use(express.json());

let favoris = [];

app.post("/favorites", (req, res) => {

  const userId = req.body.userId;
  const productId = req.body.productId;

  favoris.push({ userId, productId });

  res.send("Produit ajouté aux favoris");

});

app.get("/favorites", (req, res) => {
  res.json(favoris);
});

module.exports = app;
const express = require('express');
const path = require('path');
const router = express.Router();

// Static Routes
// Set up "public" folder / subfolders for static files
router.use(express.static(path.join(__dirname, "../public")));
router.use("/css", express.static(path.join(__dirname, "../public/css")));
router.use("/js", express.static(path.join(__dirname, "../public/js")));
router.use("/images", express.static(path.join(__dirname, "../public/images")));

module.exports = router;




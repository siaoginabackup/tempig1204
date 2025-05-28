// Import necessary Node.js and npm modules
const express = require('express'); // Express web framework
const fs = require('fs');           // Node.js File System module
const path = require('path');       // Node.js Path module
const multer = require('multer');   // Middleware for handling file uploads
const app = express();              // Create an Express app instance

// Set up static folders for serving files
app.use(express.static('public')); // Serve static files from /public
app.use('/uploads', express.static('public/uploads')); // Serve uploaded images
app.use(express.urlencoded({ extended: true })); // Middleware to parse form data

// Set up Multer to handle image uploads and storage destination
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/'), // Save images to /public/uploads/
  filename: (req, file, cb) => {
    // Generate a unique filename using timestamp and random number
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage }); // Create multer upload instance

// Load existing artworks from data.json
let artworks = [];
try {
  artworks = JSON.parse(fs.readFileSync('data.json', 'utf-8'));
} catch {
  artworks = []; // If file doesn't exist or is invalid JSON, start with empty array
}

// Save artworks array back to data.json
const saveArtwork = () => fs.writeFileSync('data.json', JSON.stringify(artworks, null, 2));

/**
 * ROUTE - Home page
 * Displays all artworks, supports search by title
 */
app.get('/', (req, res) => {
  const searchQuery = req.query.search || ''; // Get search query from URL
  const template = fs.readFileSync(path.join(__dirname, 'views', 'index.html'), 'utf-8'); // Load HTML template

const filteredArtworks = artworks   // Map artworks to add index, then filter by search query
  .map((item, index) => ({ ...item, index }))  // Add an 'index' property to each artwork so we know its position in the array
  .filter(item =>  // Filter artworks whose title includes the search query (case-insensitive)
    item.title.toLowerCase().includes(searchQuery.toLowerCase())
  )
  // Convert each artwork object into an HTML card string (so that it can be injected into HTML template)
  .map(item => ` 
    <div class="col-md-4 mb-4">
      <div class="card h-100 shadow-sm position-relative">
        ${item.image ? `<img src="/uploads/${item.image}" class="card-img-top" alt="${item.title}">` : ''}
        <div class="card-body">
          <button type="button" class="btn btn-link p-0 card-title text-start" 
            data-bs-toggle="modal" 
            data-bs-target="#artworkModal" 
            data-title="${item.title}" 
            data-date="${item.date}" 
            data-description="${item.description}">
            ${item.title}
          </button>
        </div>
        <div class="card-icons d-flex justify-content-between align-items-center gap-2 mb-3 mx-3">
          <form method="POST" action="/toggleLike/${item.index}">
            <button type="submit" class="icon-button text-danger" title="Like">
              <i class="bi ${item.liked ? 'bi-heart-fill' : 'bi-heart'}"></i>
            </button>
          </form>
          <div class="d-flex gap-2">
            <a href="/updateArtwork/${item.index}" class="icon-link edit-icon" title="Edit">
              <i class="bi bi-pencil-square"></i>
            </a>
            <form method="POST" action="/deleteArtwork/${item.index}" class="m-0 p-0 d-inline">
              <button type="submit" class="icon-button text-danger" title="Delete">
                <i class="bi bi-trash3-fill"></i>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  `)
  // Combine all the individual HTML strings into one big string
  .join('');

  const listAndSearchQuery = template   // Replace placeholder in HTML template with rendered artwork list and search query
    .replace('<!-- ARTWORK_LIST -->', filteredArtworks)
    .replace('{{search}}', searchQuery);

  res.send(listAndSearchQuery); // Send generated HTML to browser
});

/**
 * ROUTE - Favourites
 * Displays liked artworks, with search on title and description
 */
app.get('/favourites', (req, res) => { 
  const searchQuery = req.query.search || '';  // Get search query from URL
  const template = fs.readFileSync(path.join(__dirname, 'views', 'favourites.html'), 'utf-8'); // Load HTML template

  const likedArtworkHTML = artworks   // Process the artworks array to generate HTML for liked artworks that match the search query
    .map((item, index) => ({ ...item, index }))
    .filter(item =>     // Filter artworks that are liked AND where either the title or description includes the search term (case-insensitive)
      item.liked && (
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    )
    // Convert each artwork object into an HTML card string (so that it can be injected into HTML template)
    .map(item => ` 
      <div class="artwork-card">
        <div class="card-icons">
          <a href="/updateArtwork/${item.index}" class="icon-link" title="Edit">
            <i class="bi bi-pencil-square"></i>
          </a>
          <form method="POST" action="/deleteArtwork/${item.index}" class="d-inline m-0 p-0">
            <button type="submit" title="Delete" class="icon-button">
              <i class="bi bi-trash3-fill"></i>
            </button>
          </form>
        </div>
        <div class="row align-items-center">
          <div class="col-md-8">
            <h4>${item.title}</h4>
            <p id="artwork_date"><strong>Date:</strong> ${item.date}</p>
            <p id="artwork_desc">${item.description}</p>
          </div>
          <div class="col-md-4">
            ${item.image ? `<img src="/uploads/${item.image}" class="artwork-image img-fluid" alt="Artwork Image">` : ''}
          </div>
        </div>
      </div>
    `).join('');  // Join all the HTML strings into one large string (to inject into the template)

  const listAndSearchQuery = template
    .replace('<!-- FAVOURITES_LIST -->', likedArtworkHTML) // Replace placeholder in HTML template with rendered artwork list and search query
    .replace('{{search}}', searchQuery);

  res.send(listAndSearchQuery); // Send generated HTML to browser
});

/**
 * ROUTE - Add Artwork (form view)
 */
app.get('/addArtwork', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'add.html'));
});

/**
 * ROUTE - Process submitted new artwork form data
 */
app.post('/addArtwork', upload.single('image'), (req, res) => {
  const { title, date, description } = req.body;
  const image = req.file ? req.file.filename : null; // Get uploaded image filename

  if (title && date && description) {
    artworks.push({ title, date, description, image, liked: false }); // Add new artwork to the end
    saveArtwork(); // Save updated artworks list
    res.redirect('/'); // Redirect back to home
  } else {
    res.send("All fields are required (except image).");  // If missing required fields, send error message to client
  }
});

/**
 * ROUTE - Show edit artwork form with existing data filled in
 */
app.get('/updateArtwork/:id', (req, res) => {
  const id = req.params.id;
  const item = artworks[id];
  const template = fs.readFileSync(path.join(__dirname, 'views', 'update.html'), 'utf-8');

  const edited = template   // Replace placeholders in template with actual artwork data
    .replace('{{id}}', id)
    .replace('{{title}}', item.title)
    .replace('{{date}}', item.date)
    .replace('{{description}}', item.description);

  res.send(edited);   // Send the filled-in form HTML to the browser
});

/**
 * ROUTE - Process submitted edit form data
 */
app.post('/updateArtwork/:id', (req, res) => {   // Get artwork ID from URL parameters
  const id = req.params.id;
  const { title, date, description } = req.body;
  const existing = artworks[id];   // Get the existing artwork object by ID

  artworks[id] = {   // - Replace title, date, and description with new values from the form
    ...existing, // Retain existing image and like status
    title,
    date,
    description,
  };
  saveArtwork();   // Save the updated artworks array back to data.json
  res.redirect('/');
});

/**
 * ROUTE - Delete artwork and image file (if exists)
 */
app.post('/deleteArtwork/:id', (req, res) => {
  const id = req.params.id;
  const artwork = artworks[id];

  // Remove image file from disk
  if (artwork.image) {
    const imagePath = path.join(__dirname, 'public', 'uploads', artwork.image);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
  }
  artworks.splice(id, 1); // Remove from array
  saveArtwork(); 

  res.redirect('/');
});

/**
 * ROUTE - Toggle like status for artwork
 */
app.post('/toggleLike/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (artworks[id]) {   // If the artwork has an associated image file
    artworks[id].liked = !artworks[id].liked; // Toggle like boolean
    saveArtwork();
  }
  res.redirect('/');
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`SERVER: http://localhost:${PORT}`);
});